import { ResolveOnce } from "@adviser/cement";
import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";
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
}
