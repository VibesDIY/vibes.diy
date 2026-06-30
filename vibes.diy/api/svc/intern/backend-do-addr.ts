// Shared BackendDO addressing (#2856). The physical DO name + the internal headers
// the main worker (`app.ts`) and the queue consumer (`QueueCtx`) both use to talk to
// a vibe's BackendDO — kept in one place so they address the same instance the same
// way (the main worker forwards `_api` requests; the queue pokes the schedule).

/** Stamped by the worker/queue so the DO knows its vibe without re-parsing the URL. */
export const BACKEND_OWNER_HEADER = "x-vibe-owner";
export const BACKEND_SLUG_HEADER = "x-vibe-slug";
/** Set by the schedule poke so the DO re-evaluates instead of serving an `_api` request. */
export const BACKEND_OP_HEADER = "x-backend-op";
export const BACKEND_OP_ARM = "arm";
/** Set by the post-commit onChange poke (#2856 B5); the DO runs the `onChange` handler. */
export const BACKEND_OP_ONCHANGE = "onchange";

/**
 * Stable, collision-safe physical name for a vibe's `BackendDO` instance. The
 * length-prefix makes `("ab","c")` and `("a","bc")` distinct, so two vibes can never
 * co-tenant one DO (the per-vibe boundary that pairs with the per-vibe isolate id).
 */
export function backendDoName(ownerHandle: string, appSlug: string): string {
  const lenc = (s: string) => `${s.length}:${s}`;
  return `backend:${lenc(ownerHandle)}/${lenc(appSlug)}`;
}
