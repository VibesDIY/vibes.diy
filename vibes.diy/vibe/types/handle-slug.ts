// Single source of truth for handle/app slug sanitization, shared by
// @vibes.diy/api-svc (the server, which sanitizes every slug it persists) and
// @vibes.diy/base (the handle-picker preview). Lives in @vibes.diy/vibe-types
// because both packages already depend on it. LEAF MODULE: imports nothing, so a
// browser consumer pulls no server-side deps.
//
// RFC2822-ish constraint: lowercase, only [a-z0-9-], no doubled/edge dashes, ≤32
// chars. Idempotent — `f(f(x)) === f(x)` — which is what lets the client preview
// the exact slug the server will persist: the client sanitizes for display, the
// server re-sanitizes on write, and because the client output is already a fixed
// point the second pass is a no-op (VibesDIY/vibes.diy#2825).
//
// The 32-char slice happens BEFORE the trailing-dash trim, not after. If you trim
// first and slice second, truncation can land on a dash (e.g. 31 letters then
// `!b` → `…a-b` → slice → `…a-`), leaving a trailing dash the next pass would
// strip — which breaks idempotency and makes the preview drift from the persisted
// handle at the boundary.
export function toRFC2822_32ByteLength(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-+|-+$/g, "");
}
