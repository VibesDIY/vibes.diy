/**
 * Standard base64 over UTF-8 — byte-identical to the `sthis.txt.base64.encode`
 * the builder uses, and read back by its `sthis.txt.base64.decode` (see
 * vibes.diy/pkg/app/routes/chat/prompt.tsx). Done with plain browser APIs so
 * this helper carries no runtime dependency. `String.fromCharCode` over the
 * UTF-8 bytes is the canonical btoa-of-unicode pattern.
 */
function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Default builder origin a meta-vibe hands off to. Override with
 * `options.baseURL` (e.g. for cli/dev/preview environments — Phase 1 vibes run
 * cross-origin from the builder, so the origin can't be inferred from
 * `window.location`).
 */
export const VIBES_DIY_BUILDER_URL = "https://vibes.diy";

/**
 * Base64 inflates the prompt by ~4/3 and the encoded value rides in a query
 * param, so cap the whole URL well under the ~8 KB practical limit that older
 * browsers / proxies impose. Phase 2 (POST the prompt, redirect to `?pending=`)
 * removes this ceiling without changing any call site — only this helper's body
 * changes. Until then, over-threshold hand-offs warn but still proceed.
 */
export const CREATE_VIBE_SAFE_URL_LENGTH = 6000;

export interface CreateVibeOptions {
  /** Builder origin to hand off to. Defaults to {@link VIBES_DIY_BUILDER_URL}. */
  readonly baseURL?: string;
  /** Override the safe-URL-length warning threshold (default {@link CREATE_VIBE_SAFE_URL_LENGTH}). */
  readonly maxUrlLength?: number;
}

/**
 * Build the builder hand-off URL for `prompt`. Pure — it performs no
 * navigation, so it is safe to call during render (e.g. to populate an
 * `<a href>` fallback) and trivial to unit test.
 */
export function buildCreateVibeUrl(prompt: string, baseURL: string = VIBES_DIY_BUILDER_URL): string {
  // `/chat/prompt` is the route that actually consumes `prompt64`; the bare
  // homepage (`/`) ignores the param. URL/searchParams percent-encodes the
  // base64 value so `+` `/` `=` survive the query string intact.
  const url = new URL("/chat/prompt", baseURL);
  url.searchParams.set("prompt64", encodeBase64Utf8(prompt));
  return url.toString();
}

/**
 * Hand off to the Vibes builder to generate a new, personalized vibe from
 * `prompt` — the primitive behind "meta-vibes" (a vibe whose output is another
 * vibe, e.g. an interviewer that, once it has enough, builds the artifact it
 * interviewed you for).
 *
 * Phase 1 encodes `prompt` into `?prompt64=` and opens the builder in a NEW
 * TAB, leaving the calling vibe open behind it. Because it opens a tab,
 * `createVibe()` MUST be called from inside a user gesture (e.g. a button's
 * `onClick`) — the runtime iframe sandbox grants `allow-popups`, which permits
 * the popup but does not exempt it from the browser's gesture requirement.
 *
 * Returns the opened window, or `null` when the popup was blocked, so the
 * caller can fall back to a manual link (use {@link buildCreateVibeUrl} for the
 * `href`).
 */
export function createVibe(prompt: string, options: CreateVibeOptions = {}): Window | null {
  const { baseURL = VIBES_DIY_BUILDER_URL, maxUrlLength = CREATE_VIBE_SAFE_URL_LENGTH } = options;
  const url = buildCreateVibeUrl(prompt, baseURL);

  if (url.length > maxUrlLength) {
    console.warn(
      `[createVibe] hand-off URL is ${url.length} chars, over the ${maxUrlLength}-char safe threshold — ` +
        `older browsers or proxies may truncate it. Shorten the prompt, or wait for the Phase 2 POST path.`
    );
  }

  if (typeof window === "undefined") return null;

  const opened = window.open(url, "_blank");
  if (!opened) {
    console.warn(
      "[createVibe] popup blocked — call createVibe() from a click handler, or render a fallback link using buildCreateVibeUrl()."
    );
  }
  return opened;
}
