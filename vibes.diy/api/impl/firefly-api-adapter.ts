import { ResolveOnce, type Result } from "@adviser/cement";
import {
  isUserSettingDefaultUserSlug,
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type VibesDiyError,
} from "@vibes.diy/api-types";
import type { VibesDiyApi } from "./index.js";

/**
 * Bridges VibesDiyApi (WebSocket, request-object signatures) to the
 * FireflyTransport shape FireflyDatabase expects (positional, dbName,
 * appSlug/userSlug baked in via svc.vibeApp).
 *
 * One adapter per (apiUrl, appSlug) pair — typically created once per
 * process via the fireproof() factory in use-vibes.
 *
 * userSlug is resolved lazily from the user's defaultUserSlug setting
 * via ensureUserSettings({}). Pass opts.userSlug to skip the round-trip
 * (e.g. for service accounts where the token's user differs from the
 * routing user).
 */
export class FireflyApiAdapter {
  readonly svc: { readonly vibeApp: { userSlug: string; appSlug: string; fsId: string } };

  private readonly api: VibesDiyApi;
  private readonly userSlugOverride: string | undefined;
  private readonly userSlugOnce = new ResolveOnce<string>();

  constructor(api: VibesDiyApi, appSlug: string, opts?: { userSlug?: string }) {
    this.api = api;
    this.userSlugOverride = opts?.userSlug;
    // svc.vibeApp.userSlug is mutable — gets backfilled after resolveUserSlug()
    // completes. Consumers who need it before any RPC should call
    // adapter.resolveUserSlug() explicitly.
    this.svc = {
      vibeApp: {
        appSlug,
        userSlug: opts?.userSlug ?? "",
        fsId: "", // unused on the Node side; FireflyDatabase only reads userSlug+appSlug
      },
    };
  }

  async resolveUserSlug(): Promise<string> {
    if (this.userSlugOverride) return this.userSlugOverride;
    return this.userSlugOnce.once(async () => {
      const rRes = await this.api.ensureUserSettings({ settings: [] });
      if (rRes.isErr()) {
        throw new Error(`Failed to load user settings: ${rRes.Err()}`);
      }
      const def = rRes.Ok().settings.find(isUserSettingDefaultUserSlug);
      if (!def) {
        throw new Error("No defaultUserSlug — pass {userSlug} or run 'npx vibes-diy login' first");
      }
      // Backfill svc.vibeApp.userSlug so FireflyDatabase's onMsg filter works.
      (this.svc.vibeApp as { userSlug: string }).userSlug = def.userSlug;
      return def.userSlug;
    });
  }

  // ── FireflyTransport methods ───────────────────────────────────────

  async putDoc(doc: Record<string, unknown>, docId?: string, dbName = "default"): Promise<Result<ResPutDoc, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.putDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
      doc,
      ...(docId ? { docId } : {}),
    });
  }

  async getDoc(docId: string, dbName = "default"): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.getDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
      docId,
    });
  }

  async queryDocs(dbName = "default"): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
    });
  }

  async deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.deleteDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
      docId,
    });
  }

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.subscribeDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
    });
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
    this.api.onDocChanged((userSlug, appSlug, dbName, docId) => {
      fn({
        data: {
          type: "vibes.diy.evt-doc-changed",
          userSlug,
          appSlug,
          dbName,
          docId,
        },
      });
    });
  }
}
