import { ResolveOnce, Result } from "@adviser/cement";
import {
  isUserSettingDefaultHandle,
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type VibesDiyError,
  type QueryFilter,
} from "@vibes.diy/api-types";
import { type DbAcl, type ResSetDbAcl } from "@vibes.diy/vibe-types";
import type { VibesDiyApi } from "./index.js";

/**
 * Bridges VibesDiyApi (WebSocket, request-object signatures) to the
 * FireflyTransport shape FireflyDatabase expects (positional, dbName,
 * appSlug/ownerHandle baked in via svc.vibeApp).
 *
 * One adapter per (apiUrl, appSlug) pair — typically created once per
 * process via the fireproof() factory in use-vibes.
 *
 * ownerHandle is resolved lazily from the user's defaultHandle setting
 * via ensureUserSettings({}). Pass opts.ownerHandle to skip the round-trip
 * (e.g. for service accounts where the token's user differs from the
 * routing user).
 *
 * When opts.adminMode is true the adapter includes adminMode:true on each
 * getDoc/queryDocs request, allowing the server to grant owner-override access
 * per-request without a separate whoAmI round-trip. checkDocAccess only grants
 * the elevation to the actual app owner, so non-owners receive no extra access.
 */
export class FireflyApiAdapter {
  readonly svc: { readonly vibeApp: { ownerHandle: string; appSlug: string; fsId: string } };

  private readonly apiArg: VibesDiyApi | (() => Promise<VibesDiyApi>);
  private readonly apiOnce = new ResolveOnce<VibesDiyApi>();
  private readonly ownerHandleOverride: string | undefined;
  private readonly ownerHandleOnce = new ResolveOnce<string>();
  private readonly adminMode: boolean;
  private readonly openDbNames = new Set<string>();
  private readonly grantsChangedListeners: ((evt: { ownerHandle: string; appSlug: string }) => void)[] = [];
  // Grant-reactivity install state. We don't gate this on a ResolveOnce: that
  // would cache the rejection of a transient first attempt and never retry, the
  // exact failure mode #2448 describes. `installed` makes a completed install
  // idempotent; `installing` guards against the re-entrant onReconnect that can
  // fire while the very first install is still awaiting its server round-trip.
  private grantReactivityInstalled = false;
  private grantReactivityInstalling = false;
  // Armed once: registers the connection-lifecycle callback that re-issues the
  // subscriptions whose first attempt failed before the server recorded them.
  private reconnectRetryArmed = false;

  constructor(
    api: VibesDiyApi | (() => Promise<VibesDiyApi>),
    appSlug: string,
    opts?: { ownerHandle?: string; adminMode?: boolean }
  ) {
    this.apiArg = api;
    this.ownerHandleOverride = opts?.ownerHandle;
    this.adminMode = opts?.adminMode ?? false;
    // svc.vibeApp.ownerHandle is mutable — gets backfilled after resolveOwnerHandle()
    // completes. Consumers who need it before any RPC should call
    // adapter.resolveOwnerHandle() explicitly.
    this.svc = {
      vibeApp: {
        appSlug,
        ownerHandle: opts?.ownerHandle ?? "",
        fsId: "", // unused on the Node side; FireflyDatabase only reads ownerHandle+appSlug
      },
    };
  }

  private async getApi(): Promise<VibesDiyApi> {
    // ResolveOnce caches a rejection, which would permanently break the
    // reconnect retry path if the api factory fails transiently at startup
    // (the default fireproof() factory does a network bootstrap to resolve the
    // owner handle). Reset on failure so a later reconnect re-runs it (#2448).
    try {
      return await this.apiOnce.once(async () => (typeof this.apiArg === "function" ? this.apiArg() : this.apiArg));
    } catch (e) {
      this.apiOnce.reset();
      throw e;
    }
  }

  async resolveOwnerHandle(): Promise<string> {
    if (this.ownerHandleOverride !== undefined) return this.ownerHandleOverride;
    // Same rejection-caching hazard as getApi: in the default fireproof() path
    // this lookup runs over the WebSocket, so a transient startup failure here
    // must not be cached forever — otherwise the reconnect retry re-enters
    // subscribeDocs() and immediately gets the cached rejection, never
    // subscribing (#2448). Reset on failure so the next reconnect retries.
    try {
      return await this.ownerHandleOnce.once(async () => {
        const rRes = await (await this.getApi()).ensureUserSettings({ settings: [] });
        if (rRes.isErr()) {
          throw new Error(`Failed to load user settings: ${rRes.Err()}`);
        }
        const def = rRes.Ok().settings.find(isUserSettingDefaultHandle);
        if (def === undefined) {
          throw new Error("No defaultHandle — pass {ownerHandle} or run 'npx vibes-diy login' first");
        }
        // Backfill svc.vibeApp.ownerHandle so FireflyDatabase's onMsg filter works.
        (this.svc.vibeApp as { ownerHandle: string }).ownerHandle = def.ownerHandle;
        return def.ownerHandle;
      });
    } catch (e) {
      this.ownerHandleOnce.reset();
      throw e;
    }
  }

  // ── FireflyTransport methods ───────────────────────────────────────

  async putDoc(doc: Record<string, unknown>, docId?: string, dbName = "default"): Promise<Result<ResPutDoc, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return (await this.getApi()).putDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      doc,
      ...(docId ? { docId } : {}),
    });
  }

  async getDoc(docId: string, dbName = "default"): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return (await this.getApi()).getDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      docId,
      ...(this.adminMode ? { adminMode: true } : {}),
    });
  }

  async queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return (await this.getApi()).queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      ...(filter !== undefined ? { filter } : {}),
      ...(this.adminMode ? { adminMode: true } : {}),
    });
  }

  async deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return (await this.getApi()).deleteDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      docId,
    });
  }

  // Ephemeral presence broadcast (#1756). Fire-and-forget: no await in the hot
  // path (presence fires at up to 60Hz). Uses the already-backfilled
  // svc.vibeApp.ownerHandle — presence starts after mount, by which point it is
  // resolved. If it's not yet set, we drop this frame (the next coalesced merge
  // frame carries the latest snapshot).
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName = "default"): void {
    const ownerHandle = this.svc.vibeApp.ownerHandle;
    if (!ownerHandle) return; // owner handle not yet resolved — drop this frame
    const send = (a: VibesDiyApi): void =>
      a.broadcastEphemeral({ appSlug: this.svc.vibeApp.appSlug, ownerHandle, dbName, docId, doc });
    const api = typeof this.apiArg !== "function" ? this.apiArg : undefined;
    if (api) {
      send(api);
    } else {
      this.getApi()
        .then(send)
        .catch(() => undefined);
    }
  }

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    // Record the db name synchronously, before any await: if this first attempt
    // fails at the transport (server never records it for replay), the
    // connection-lifecycle retry below still knows to re-issue it (#2448).
    this.openDbNames.add(dbName);
    const api = await this.getApi();
    this.armReconnectRetry(api);
    const ownerHandle = await this.resolveOwnerHandle();
    return api.subscribeDocs({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
    });
  }

  /**
   * Opt into live grant-reactivity. On a viewer-grants-changed for this app,
   * re-issue subscribeDocs for every open db (the event is app-coarse) so future
   * writes to a newly-granted channel flow live, and notify onGrantsChanged
   * listeners. Forward-only: no backfill. Idempotent.
   *
   * Resilient to a transient startup failure: if the first install can't reach
   * the API, it is retried on the connection-lifecycle callback armed below once
   * the connection recovers, instead of staying uninstalled until restart
   * (#2448).
   */
  async enableGrantReactivity(): Promise<void> {
    await this.installGrantReactivity();
  }

  private async installGrantReactivity(): Promise<void> {
    if (this.grantReactivityInstalled || this.grantReactivityInstalling) return;
    this.grantReactivityInstalling = true;
    try {
      const api = await this.getApi();
      // Arm before the round-trip below so a recovery path exists even if this
      // first subscribeViewerGrants rejects.
      this.armReconnectRetry(api);
      const ownerHandle = await this.resolveOwnerHandle();
      const rSub = await api.subscribeViewerGrants({ ownerHandle, appSlug: this.svc.vibeApp.appSlug });
      // A Result.Err — the normal path for a request timeout or a WS close
      // before the response, not just a thrown exception — means VibesDiyApi did
      // NOT record the subscription for replay. Leave grantReactivityInstalled
      // false and let the next reconnect retry, rather than marking it installed
      // with nothing for replayConnectionState to re-issue (#2448).
      if (rSub.isErr()) {
        throw new Error(`subscribeViewerGrants failed: ${rSub.Err()}`);
      }
      // Attach the listener only after the subscribe succeeds — and only once
      // (guarded by grantReactivityInstalled) so reconnect retries never stack
      // duplicate listeners. replayConnectionState re-attaches it across later
      // reconnects.
      api.onViewerGrantsChanged((evt) => {
        for (const dbName of this.openDbNames) {
          void this.subscribeDocs(dbName);
        }
        for (const fn of this.grantsChangedListeners) {
          fn({ ownerHandle: evt.ownerHandle, appSlug: evt.appSlug });
        }
      });
      this.grantReactivityInstalled = true;
    } finally {
      this.grantReactivityInstalling = false;
    }
  }

  /**
   * Register — exactly once per adapter — the connection-lifecycle callback that
   * recovers subscriptions whose first attempt failed before the server could
   * record them for replay (#2448). It fires only when a connection actually
   * (re)establishes, so a permanently bad apiUrl that never connects can't spin.
   */
  private armReconnectRetry(api: VibesDiyApi): void {
    if (this.reconnectRetryArmed) return;
    this.reconnectRetryArmed = true;
    api.onReconnect(() => {
      if (!this.grantReactivityInstalled) {
        void this.installGrantReactivity().catch(() => undefined);
      }
      // Re-issue every db subscription opened on this adapter. Safe to repeat:
      // subscribeDocs dedupes both server-side and in VibesDiyApi.
      for (const dbName of this.openDbNames) {
        void this.subscribeDocs(dbName).catch(() => undefined);
      }
    });
  }

  /** Register a consumer callback for grant changes (opt-in app re-pull). */
  onGrantsChanged(fn: (evt: { ownerHandle: string; appSlug: string }) => void): () => void {
    this.grantsChangedListeners.push(fn);
    return () => {
      const i = this.grantsChangedListeners.indexOf(fn);
      if (i >= 0) this.grantsChangedListeners.splice(i, 1);
    };
  }

  async setDbAcl(_dbName: string, _acl: DbAcl): Promise<Result<ResSetDbAcl>> {
    return Result.Err("setDbAcl not supported in standalone fireproof adapter");
  }

  async putAsset(_blob: Blob, _mimeType?: string): Promise<Result<unknown>> {
    throw new Error("file uploads not supported in standalone fireproof — coming in a future release");
  }

  /**
   * Bridge VibesDiyApi.onDocChanged callbacks into the `{data: {type:
   * "vibes.diy.evt-doc-changed", ...}}` event shape FireflyDatabase's
   * onMsg listener expects. Multiple onMsg subscribers are supported —
   * each call registers an independent listener via `onDocChanged`; all
   * active subscribers receive each event.
   */
  onMsg(fn: (event: { data: unknown }) => void): void {
    const register = (api: VibesDiyApi): void => {
      api.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
        fn({ data: { type: "vibes.diy.evt-doc-changed", ownerHandle, appSlug, dbName, docId } });
      });
      // Ephemeral presence (#1756): forward the full evt (snapshot + originPeer +
      // channel) so FireflyDatabase can fold it into its overlay.
      api.onDocEphemeral((evt) => {
        fn({ data: evt });
      });
      api.onDocEphemeralDrop((originPeer) => {
        fn({ data: { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer } });
      });
    };
    if (typeof this.apiArg !== "function") {
      register(this.apiArg);
    } else {
      // Best-effort: getApi() can reject when the connection fails (e.g. a bad
      // apiUrl). Swallow so this fire-and-forget registration never becomes an
      // unhandled rejection that crashes the process (#2444).
      this.getApi()
        .then(register)
        .catch(() => undefined);
    }
  }
}
