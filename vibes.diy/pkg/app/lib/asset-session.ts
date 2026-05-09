// Client-side helper for the asset-host session bridge.
//
// Posts the parent shell's Clerk Bearer to `https://assets.<base>/_auth/session`
// once at iframe boot (or on Clerk login / token rotation). The server mints
// a host-only HttpOnly cookie scoped to the asset host; browsers auto-attach
// it to subsequent <img>/<video> subresource fetches. Vibe code never touches
// the cookie — it's HttpOnly + scoped to a different origin.
//
// Coordination: KeyedResolvOnce-cached per hostnameBase. Multiple callers
// (Clerk listener firing on every session event, srv-sandbox bridge gate
// firing on every iframe boot) all coordinate through one in-flight promise
// per host. Mirrors the tokenCache pattern in
// vibe/runtime/register-dependencies.ts.
//
// TTL: cache resets after 95% of the cookie's Max-Age (returned in the
// response body), so the next caller refetches transparently before the
// browser would notice expiry.

import { exception2Result, KeyedResolvOnce, Result } from "@adviser/cement";
import { type } from "arktype";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

const ResAuthSession = type({
  type: "'vibes.diy.res-auth-session'",
  maxAge: "number",
});

export interface EnsureAssetSessionDeps {
  // Same thunk shape as VibesDiyApi.getToken — returns the Clerk Bearer
  // (or "device-id"/etc.) currently in use.
  readonly getToken: () => Promise<Result<DashAuthType>>;
  // The hostnameBase env value (e.g. "cli-v2.vibesdiy.net"); we prepend
  // "assets." to derive the asset host.
  readonly hostnameBase: string;
  // Optional fetcher injection for tests; defaults to globalThis.fetch.
  readonly fetch?: typeof fetch;
}

// Module-level cache. Identical-key concurrent calls share one promise;
// different hostnameBase values (e.g. localhost in tests vs. cli in prod)
// don't interfere.
const sessionCache = new KeyedResolvOnce<Result<void>>();

function bridgeUrl(hostnameBase: string, path: string): string {
  // Always https; the asset host is Secure-only (the cookie sets `Secure`).
  // In dev, every virtual host (`<app>--<user>.<base>`, `assets.<base>`) is
  // served by a single Vite listener on a non-standard port, so reuse the
  // current window port for the asset host. Empty in prod (default 443).
  const port = typeof globalThis !== "undefined" && globalThis.location?.port ? `:${globalThis.location.port}` : "";
  return `https://assets.${hostnameBase.replace(/^\./, "")}${port}${path}`;
}

export async function ensureAssetSession(deps: EnsureAssetSessionDeps): Promise<Result<void>> {
  const { getToken, hostnameBase } = deps;
  const fetcher = deps.fetch ?? globalThis.fetch;
  const result = await sessionCache.get(hostnameBase).once(async (opts) => {
    const rAuth = await getToken();
    if (rAuth.isErr()) {
      return Result.Err(rAuth);
    }
    const auth = rAuth.Ok();
    if (auth.type !== "clerk") {
      // device-id and other auth types aren't bridged today; succeed silently
      // so a public-readable view still works without churn.
      return Result.Ok(undefined);
    }
    const rRes = await exception2Result(() =>
      fetcher(bridgeUrl(hostnameBase, "/_auth/session"), {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${auth.token}` },
      })
    );
    if (rRes.isErr()) return Result.Err(rRes);
    const res = rRes.Ok();
    if (!res.ok) {
      return Result.Err(`/_auth/session ${res.status} ${res.statusText}`);
    }
    const rBody = await exception2Result(() => res.json());
    if (rBody.isErr()) return Result.Err(rBody);
    const validated = ResAuthSession(rBody.Ok());
    if (validated instanceof type.errors) {
      return Result.Err(`/_auth/session response shape: ${validated.summary}`);
    }
    // Refetch shortly before the cookie expires so callers always observe
    // a fresh session. 95% of Max-Age leaves a small margin for clock skew.
    opts.self.setResetAfter(Math.max(1, Math.floor(validated.maxAge * 950)));
    return Result.Ok(undefined);
  });
  // Errors are treated as transient (no token yet, network blip, server hiccup)
  // — don't pin the cache. setResetAfter(<small>) inside .once() doesn't help
  // because the timer fires asynchronously and a second caller can race past
  // it. unget() is synchronous + idempotent, which is what we want.
  if (result.isErr()) {
    sessionCache.unget(hostnameBase);
  }
  return result;
}

export async function tearDownAssetSession(deps: { hostnameBase: string; fetch?: typeof fetch }): Promise<void> {
  const fetcher = deps.fetch ?? globalThis.fetch;
  // Drop the cached promise so the next ensureAssetSession refetches.
  sessionCache.unget(deps.hostnameBase);
  // Best-effort logout — Clerk's listener already wiped the local token,
  // and the cookie's Max-Age caps server-side staleness regardless. Any
  // failure here is recoverable on next sign-in (which calls ensure again).
  await exception2Result(() =>
    fetcher(bridgeUrl(deps.hostnameBase, "/_auth/logout"), {
      method: "POST",
      credentials: "include",
    })
  );
}

// Test seam: lets unit tests reset cross-test cache state without
// importing private internals.
export function __resetAssetSessionCacheForTests(): void {
  sessionCache.reset();
}
