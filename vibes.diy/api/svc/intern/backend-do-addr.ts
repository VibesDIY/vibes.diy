// Shared BackendDO addressing (#2856). The physical DO name + the internal headers
// the main worker (`app.ts`) and the queue consumer (`QueueCtx`) both use to talk to
// a vibe's BackendDO — kept in one place so they address the same instance the same
// way (the main worker forwards `_api` requests; the queue pokes the schedule).

import { BACKEND_DB_OP_URL } from "./backend-db-op.js";

/** Stamped by the worker/queue so the DO knows its vibe without re-parsing the URL. */
export const BACKEND_OWNER_HEADER = "x-vibe-owner";
export const BACKEND_SLUG_HEADER = "x-vibe-slug";
/**
 * Set by the schedule poke / onChange poke so the DO runs a control-plane op
 * instead of serving an `_api` request. **Internal-only** — it must never survive
 * client `_api` forwarding (see `sanitizeBackendApiForwardHeaders`), or a public
 * request could invoke `arm`/`onChange` directly with an attacker-controlled body.
 */
export const BACKEND_OP_HEADER = "x-backend-op";
export const BACKEND_OP_ARM = "arm";
/** Set by the post-commit onChange poke (#2856 B5); the DO runs the `onChange` handler. */
export const BACKEND_OP_ONCHANGE = "onchange";

/** Minimal Headers surface used by the `_api` forward sanitizer (worker `Headers` or undici). */
interface MutableHeaders {
  set(name: string, value: string): void;
  delete(name: string): void;
}

/**
 * Sanitize the headers of a client `_api` request before forwarding it to a vibe's
 * `BackendDO` (#2856). Two trust-boundary guarantees:
 *
 * 1. **Strip the internal control header** (`BACKEND_OP_HEADER`). A client could
 *    otherwise set `x-backend-op: onchange`/`arm` on a public `/_api/...` request and
 *    invoke a control-plane op directly — running the handler outside the post-commit
 *    queue path with an arbitrary payload (security blocker, Charlie). `_api` traffic
 *    must reach the DO with **no** op so it falls through to the fetch path.
 * 2. **Overwrite owner/slug** with the values the worker resolved from the route, so a
 *    client-supplied `x-vibe-owner`/`x-vibe-slug` can't redirect to another vibe.
 */
export function sanitizeBackendApiForwardHeaders(headers: MutableHeaders, target: { ownerHandle: string; appSlug: string }): void {
  headers.delete(BACKEND_OP_HEADER);
  headers.set(BACKEND_OWNER_HEADER, target.ownerHandle);
  headers.set(BACKEND_SLUG_HEADER, target.appSlug);
}

/**
 * Wrap a raw `BackendDO` stub so an untrusted isolate's `globalOutbound` can reach
 * **only** the nonce-gated db-op URL (#2856 security review).
 *
 * `globalOutbound` intercepts every `fetch()` the handler makes. The raw DO stub
 * would expose the DO's control-plane ops (`arm`/`onChange`), which its `fetch`
 * dispatches on the `x-backend-op` header alone — a header the handler can set,
 * since its own `{ownerHandle, appSlug}` are compiled into `ctx.appInfo`. That would
 * let a handler forge an `onChange` poke with an attacker-controlled `writerUserId`
 * (identity spoof) and `depth: 0` (loop-guard reset ⇒ unbounded amplification), and
 * reach any other DO surface / open egress. This wrapper forwards a request only
 * when its URL is exactly `BACKEND_DB_OP_URL` (still gated by the per-invocation
 * nonce host-side) and returns a caller-supplied "forbidden" response otherwise.
 *
 * Kept pure + generic (`makeForbidden` supplies the runtime `Response`) so it's
 * unit-testable without a live DO or CF `Response`.
 */
export function narrowIsolateDbEgress<
  Req extends { readonly url: string },
  Res,
  Stub extends { fetch(request: Req): Promise<Res> },
>(rawStub: Stub, makeForbidden: () => Res): { fetch(request: Req): Promise<Res> } {
  return {
    fetch(request: Req): Promise<Res> {
      if (request.url !== BACKEND_DB_OP_URL) {
        return Promise.resolve(makeForbidden());
      }
      return rawStub.fetch(request);
    },
  };
}

/**
 * Stable, collision-safe physical name for a vibe's `BackendDO` instance. The
 * length-prefix makes `("ab","c")` and `("a","bc")` distinct, so two vibes can never
 * co-tenant one DO (the per-vibe boundary that pairs with the per-vibe isolate id).
 */
export function backendDoName(ownerHandle: string, appSlug: string): string {
  const lenc = (s: string) => `${s.length}:${s}`;
  return `backend:${lenc(ownerHandle)}/${lenc(appSlug)}`;
}
