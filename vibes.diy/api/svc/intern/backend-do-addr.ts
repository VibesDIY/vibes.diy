// Shared BackendDO addressing (#2856). The physical DO name + the internal headers
// the main worker (`app.ts`) and the queue consumer (`QueueCtx`) both use to talk to
// a vibe's BackendDO — kept in one place so they address the same instance the same
// way (the main worker forwards `_api` requests; the queue pokes the schedule).

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

/**
 * Internal-auth header carrying the `BACKEND_INTERNAL_SECRET` on a trusted
 * control-plane poke (#2856 security). The queue consumer stamps it on `arm`/
 * `onChange`; the DO requires it for those ops when the secret is configured. It
 * MUST be stripped from any client `_api` forward (see `sanitizeBackendApiForwardHeaders`)
 * so a public request can never smuggle a forged value toward the control plane, and
 * it MUST NEVER be placed in the isolate's `WorkerCode.env`, so untrusted handler
 * code can't read or replay it.
 */
export const BACKEND_INTERNAL_AUTH_HEADER = "x-backend-internal-auth";

/**
 * Decide whether a control-plane poke (`arm`/`onChange`) reaching the BackendDO is
 * authorized (#2856 security). **Merge-safe:** when no secret is configured the DO
 * stays permissive (`true`) — identical to pre-secret behavior — so the gate is inert
 * until the secret is provisioned in both the main-worker and queue-consumer envs.
 * When a secret IS configured, the poke must carry the exact matching value; a
 * missing/mismatched header (the isolate has no worker `env`, so it can't produce it)
 * is rejected.
 */
export function isControlPlaneAuthorized(secret: string | undefined, provided: string | null): boolean {
  if (!secret) return true;
  return provided === secret;
}

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
 * 3. **Strip the internal-auth header** (`BACKEND_INTERNAL_AUTH_HEADER`) so a public
 *    `_api` request can never smuggle a forged control-plane credential to the DO.
 */
export function sanitizeBackendApiForwardHeaders(headers: MutableHeaders, target: { ownerHandle: string; appSlug: string }): void {
  headers.delete(BACKEND_OP_HEADER);
  headers.delete(BACKEND_INTERNAL_AUTH_HEADER);
  headers.set(BACKEND_OWNER_HEADER, target.ownerHandle);
  headers.set(BACKEND_SLUG_HEADER, target.appSlug);
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
