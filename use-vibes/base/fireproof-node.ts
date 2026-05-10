/**
 * Standalone fireproof() factory for Node.js / Wrangler consumers.
 *
 * Module-level singletons:
 *  - sharedAdapter: Lazy<FireflyApiAdapter> — first fireproof() call's
 *    opts win. Subsequent calls reuse the cached adapter, so N
 *    fireproof(name) calls share one VibesDiyApi/WebSocket/userSlug.
 *  - databasesByName: KeyedResolvOnce<FireflyDatabase> — per-name cache
 *    so fireproof("x") returns the same instance across the process.
 *
 * Inside an iframe, the import map rewrites use-vibes -> vibe-runtime,
 * which exports its own fireproof("name") backed by VibeSandboxApi.
 * This module is only reached by Node / Wrangler consumers.
 */
import path from "node:path";
import { Lazy, KeyedResolvOnce, type Result } from "@adviser/cement";
import { VibesDiyApi, FireflyApiAdapter } from "@vibes.diy/api-impl";
import { FireflyDatabase } from "@vibes.diy/vibe-runtime";
import { ensureSuperThis } from "@fireproof/core-runtime";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

export interface FireproofOpts {
  apiUrl?: string;
  appSlug?: string;
  userSlug?: string;
  getToken?: () => Promise<Result<DashAuthType>>;
}

interface ResolvedOpts {
  apiUrl: string;
  appSlug: string;
  userSlug: string | undefined;
  getToken: () => Promise<Result<DashAuthType>>;
}

const DEFAULT_API_URL = "https://vibes.diy/api";

const lazyKeybagGetToken = Lazy(async () => {
  const mod = await import("./firefly-defaults.node.js");
  return mod.loadDeviceIdGetToken(ensureSuperThis());
});

function resolveOptsSync(opts?: FireproofOpts): ResolvedOpts {
  const apiUrl = opts?.apiUrl ?? process.env.VIBES_DIY_API_URL ?? DEFAULT_API_URL;
  const appSlug = opts?.appSlug ?? process.env.VIBES_APP_SLUG ?? path.basename(process.cwd());
  if (!appSlug) {
    throw new Error("Set VIBES_APP_SLUG or pass {appSlug} to fireproof()");
  }
  const getToken =
    opts?.getToken ??
    (async () => {
      const inner = await lazyKeybagGetToken();
      return inner();
    });
  return { apiUrl, appSlug, userSlug: opts?.userSlug, getToken };
}

let sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
  const api = new VibesDiyApi({
    apiUrl: resolved.apiUrl,
    getToken: resolved.getToken,
  });
  return new FireflyApiAdapter(api, resolved.appSlug, resolved.userSlug ? { userSlug: resolved.userSlug } : undefined);
});

let databasesByName = new KeyedResolvOnce<FireflyDatabase>();

/**
 * Standalone fireproof() factory.
 *
 * Bare form `fireproof("todos")` auto-resolves auth/userSlug/appSlug from
 * local CLI state populated by `npx vibes-diy login`.
 *
 * **First-call-wins for opts.** The first call to fireproof() in a process
 * binds apiUrl/appSlug/getToken/userSlug to the singleton adapter — later
 * calls' opts arguments are silently ignored (matches the legacy fireproof()
 * mental model where opts are config-time, not call-time). Callers that need
 * different configs in one process should construct VibesDiyApi +
 * FireflyApiAdapter + FireflyDatabase directly.
 */
export function fireproof(name: string, opts?: FireproofOpts): FireflyDatabase {
  const resolved = resolveOptsSync(opts);
  return databasesByName.get(name).once(() => new FireflyDatabase(name, sharedAdapter(resolved)));
}

/** @internal — for tests only. Resets the module-level singletons. */
export function __resetFireproofForTesting(): void {
  sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
    const api = new VibesDiyApi({
      apiUrl: resolved.apiUrl,
      getToken: resolved.getToken,
    });
    return new FireflyApiAdapter(api, resolved.appSlug, resolved.userSlug ? { userSlug: resolved.userSlug } : undefined);
  });
  databasesByName = new KeyedResolvOnce<FireflyDatabase>();
}
