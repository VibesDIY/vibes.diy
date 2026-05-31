/**
 * Standalone fireproof() factory for Node.js / Wrangler consumers.
 *
 * Module-level singletons:
 *  - sharedAdapter: Lazy<FireflyApiAdapter> — first fireproof() call's
 *    opts win. Subsequent calls reuse the cached adapter, so N
 *    fireproof(name) calls share one VibesDiyApi/WebSocket/userHandle.
 *  - databasesByName: KeyedResolvOnce<FireflyDatabase> — per-name cache
 *    so fireproof("x") returns the same instance across the process.
 *
 * Inside an iframe, the import map rewrites use-vibes -> vibe-runtime,
 * which exports its own fireproof("name") backed by VibeSandboxApi.
 * This module is only reached by Node / Wrangler consumers.
 *
 * **Browser-link safety.** This module is re-exported from `use-vibes`'s
 * top-level entry, so browser bundles will *link* it even when they only
 * use `useFireproof`/`useVibes`. Top-level imports MUST stay browser-safe;
 * Node-only modules (keybag, device-id) live behind a dynamic import in
 * `lazyKeybagGetToken`. Native `node:path` is replaced by inline basename
 * logic so Vite/webpack don't fail at module-link time.
 */
import { Lazy, KeyedResolvOnce, type Result } from "@adviser/cement";
import { VibesDiyApi, FireflyApiAdapter } from "@vibes.diy/api-impl";
import { FireflyDatabase } from "@vibes.diy/vibe-runtime";
import { ensureSuperThis } from "@fireproof/core-runtime";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

export interface FireproofOpts {
  apiUrl?: string;
  appSlug?: string;
  userHandle?: string;
  getToken?: () => Promise<Result<DashAuthType>>;
}

interface ResolvedOpts {
  apiUrl: string;
  appSlug: string;
  userHandle: string | undefined;
  getToken: () => Promise<Result<DashAuthType>>;
}

const DEFAULT_API_URL = "https://vibes.diy/api";

const lazyKeybagGetToken = Lazy(async () => {
  const mod = await import("./firefly-defaults.node.js");
  return mod.loadDeviceIdGetToken(ensureSuperThis());
});

// Inlined `path.basename` so this module doesn't import `node:path` at the top
// level (which would break browser bundles that only link the module without
// calling fireproof()). Returns "" in non-Node environments — caller handles.
function defaultAppSlugFromCwd(): string {
  if (typeof process === "undefined" || typeof process.cwd !== "function") return "";
  const cwd = process.cwd();
  const idx = Math.max(cwd.lastIndexOf("/"), cwd.lastIndexOf("\\"));
  return idx >= 0 ? cwd.slice(idx + 1) : cwd;
}

function envVar(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

function resolveOptsSync(opts?: FireproofOpts): ResolvedOpts {
  const apiUrl = opts?.apiUrl ?? envVar("VIBES_DIY_API_URL") ?? DEFAULT_API_URL;
  const appSlug = opts?.appSlug ?? envVar("VIBES_APP_SLUG") ?? defaultAppSlugFromCwd();
  if (appSlug === "") {
    throw new Error("Set VIBES_APP_SLUG or pass {appSlug} to fireproof()");
  }
  const getToken =
    opts?.getToken ??
    (async () => {
      const inner = await lazyKeybagGetToken();
      return inner();
    });
  return { apiUrl, appSlug, userHandle: opts?.userHandle, getToken };
}

let sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
  const api = new VibesDiyApi({
    apiUrl: resolved.apiUrl,
    getToken: resolved.getToken,
  });
  return new FireflyApiAdapter(api, resolved.appSlug, resolved.userHandle ? { userHandle: resolved.userHandle } : undefined);
});

let databasesByName = new KeyedResolvOnce<FireflyDatabase>();

/**
 * Standalone fireproof() factory.
 *
 * Bare form `fireproof("todos")` auto-resolves auth/userHandle/appSlug from
 * local CLI state populated by `npx vibes-diy login`.
 *
 * **First-call-wins for opts.** The first call to fireproof() in a process
 * binds apiUrl/appSlug/getToken/userHandle to the singleton adapter — later
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
    return new FireflyApiAdapter(api, resolved.appSlug, resolved.userHandle ? { userHandle: resolved.userHandle } : undefined);
  });
  databasesByName = new KeyedResolvOnce<FireflyDatabase>();
}
