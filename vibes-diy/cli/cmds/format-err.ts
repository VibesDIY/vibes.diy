/**
 * Render an unknown error value (typically the payload of a `Result.Err`)
 * as a single human-legible string for `${...}` interpolation.
 *
 * Prevents `[object Object]` showing up in CLI error messages, while keeping
 * already-readable shapes (strings, Error.message, server VibesDiyError
 * envelopes) verbatim instead of wrapping them in JSON braces.
 */
export function formatErr(err: unknown): string {
  if (err === null || err === undefined) return String(err);
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);

  // Server-style envelope: { type: "vibes.diy.res-error", error: { message, code? } }
  const errorField = (err as { error?: unknown }).error;
  if (errorField && typeof errorField === "object") {
    const inner = errorField as { message?: unknown; code?: unknown };
    if (typeof inner.message === "string") {
      return typeof inner.code === "string" ? `[${inner.code}] ${inner.message}` : inner.message;
    }
  }

  // Plain Error (or anything carrying a string `message` field)
  const message = (err as { message?: unknown }).message;
  if (typeof message === "string") return message;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
