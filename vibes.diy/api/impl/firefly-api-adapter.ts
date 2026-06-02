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
 */
export class FireflyApiAdapter {
  readonly svc: { readonly vibeApp: { ownerHandle: string; appSlug: string; fsId: string } };

  private readonly api: VibesDiyApi;
  private readonly ownerHandleOverride: string | undefined;
  private readonly ownerHandleOnce = new ResolveOnce<string>();

  constructor(api: VibesDiyApi, appSlug: string, opts?: { ownerHandle?: string }) {
    this.api = api;
    this.ownerHandleOverride = opts?.ownerHandle;
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

  async resolveOwnerHandle(): Promise<string> {
    if (this.ownerHandleOverride !== undefined) return this.ownerHandleOverride;
    return this.ownerHandleOnce.once(async () => {
      const rRes = await this.api.ensureUserSettings({ settings: [] });
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
    return this.api.putDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      doc,
      ...(docId ? { docId } : {}),
    });
  }

  async getDoc(docId: string, dbName = "default"): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return this.api.getDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      docId,
    });
  }

  async queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      ...(filter !== undefined ? { filter } : {}),
    });
  }

  async deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return this.api.deleteDoc({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
      docId,
    });
  }

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    return this.api.subscribeDocs({
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle,
      dbName,
    });
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
