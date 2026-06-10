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
  private readonly grantReactivityOnce = new ResolveOnce<void>();

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
    return this.apiOnce.once(async () => (typeof this.apiArg === "function" ? this.apiArg() : this.apiArg));
  }

  async resolveOwnerHandle(): Promise<string> {
    if (this.ownerHandleOverride !== undefined) return this.ownerHandleOverride;
    return this.ownerHandleOnce.once(async () => {
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

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    this.openDbNames.add(dbName);
    return (await this.getApi()).subscribeDocs({
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
   */
  async enableGrantReactivity(): Promise<void> {
    return this.grantReactivityOnce.once(async () => {
      const ownerHandle = await this.resolveOwnerHandle();
      const api = await this.getApi();
      await api.subscribeViewerGrants({ ownerHandle, appSlug: this.svc.vibeApp.appSlug });
      api.onViewerGrantsChanged((evt) => {
        for (const dbName of this.openDbNames) {
          void this.subscribeDocs(dbName);
        }
        for (const fn of this.grantsChangedListeners) {
          fn({ ownerHandle: evt.ownerHandle, appSlug: evt.appSlug });
        }
      });
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
    };
    if (typeof this.apiArg !== "function") {
      register(this.apiArg);
    } else {
      void this.getApi().then(register);
    }
  }
}
