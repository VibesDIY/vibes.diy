import { ResolveOnce, Result } from "@adviser/cement";
import {
  isUserSettingDefaultUserSlug,
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
 * appSlug/userHandle baked in via svc.vibeApp).
 *
 * One adapter per (apiUrl, appSlug) pair — typically created once per
 * process via the fireproof() factory in use-vibes.
 *
 * userHandle is resolved lazily from the user's defaultUserSlug setting
 * via ensureUserSettings({}). Pass opts.userHandle to skip the round-trip
 * (e.g. for service accounts where the token's user differs from the
 * routing user).
 */
export class FireflyApiAdapter {
  readonly svc: { readonly vibeApp: { userHandle: string; appSlug: string; fsId: string } };

  private readonly api: VibesDiyApi;
  private readonly userHandleOverride: string | undefined;
  private readonly userHandleOnce = new ResolveOnce<string>();

  constructor(api: VibesDiyApi, appSlug: string, opts?: { userHandle?: string }) {
    this.api = api;
    this.userHandleOverride = opts?.userHandle;
    // svc.vibeApp.userHandle is mutable — gets backfilled after resolveUserHandle()
    // completes. Consumers who need it before any RPC should call
    // adapter.resolveUserHandle() explicitly.
    this.svc = {
      vibeApp: {
        appSlug,
        userHandle: opts?.userHandle ?? "",
        fsId: "", // unused on the Node side; FireflyDatabase only reads userHandle+appSlug
      },
    };
  }

  async resolveUserHandle(): Promise<string> {
    if (this.userHandleOverride !== undefined) return this.userHandleOverride;
    return this.userHandleOnce.once(async () => {
      const rRes = await this.api.ensureUserSettings({ settings: [] });
      if (rRes.isErr()) {
        throw new Error(`Failed to load user settings: ${rRes.Err()}`);
      }
      const def = rRes.Ok().settings.find(isUserSettingDefaultUserSlug);
      if (def === undefined) {
        throw new Error("No defaultUserSlug — pass {userHandle} or run 'npx vibes-diy login' first");
      }
      // Backfill svc.vibeApp.userHandle so FireflyDatabase's onMsg filter works.
      (this.svc.vibeApp as { userHandle: string }).userHandle = def.userSlug;
      return def.userSlug;
    });
  }

  // ── FireflyTransport methods ───────────────────────────────────────

  async putDoc(doc: Record<string, unknown>, docId?: string, dbName = "default"): Promise<Result<ResPutDoc, VibesDiyError>> {
    const userHandle = await this.resolveUserHandle();
    return this.api.putDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: userHandle,
      dbName,
      doc,
      ...(docId ? { docId } : {}),
    });
  }

  async getDoc(docId: string, dbName = "default"): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    const userHandle = await this.resolveUserHandle();
    return this.api.getDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: userHandle,
      dbName,
      docId,
    });
  }

  async queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const userHandle = await this.resolveUserHandle();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: userHandle,
      dbName,
      ...(filter !== undefined ? { filter } : {}),
    });
  }

  async deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    const userHandle = await this.resolveUserHandle();
    return this.api.deleteDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: userHandle,
      dbName,
      docId,
    });
  }

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const userHandle = await this.resolveUserHandle();
    return this.api.subscribeDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug: userHandle,
      dbName,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    this.api.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
      fn({
        data: {
          type: "vibes.diy.evt-doc-changed",
          ownerHandle,
          appSlug,
          dbName,
          docId,
        },
      });
    });
  }
}
