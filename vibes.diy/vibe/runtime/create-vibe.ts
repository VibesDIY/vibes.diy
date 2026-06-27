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
 * The public builder domain. Every environment hands off here EXCEPT a PR
 * preview deploy (see {@link resolveBuilderOriginFrom}). cli, dev, the sandbox
 * subdomains, and the stable-entry backends are all internal hosts that must
 * never leak into a hand-off URL, so they fall through to this.
 */
export const VIBES_DIY_BUILDER_URL = "https://vibes.diy";

// A PR-preview deploy host, e.g. `pr-2694-vibes-diy-v2.jchris.workers.dev`
// (.github/workflows/vibes-diy-pr-preview.yaml deploys `pr-{N}-vibes-diy-v2` on
// workers.dev). This is the ONLY non-prod origin we ever hand off to.
const PREVIEW_HOST = /^pr-\d+-vibes-diy-v2\.[a-z0-9-]+\.workers\.dev$/i;

function isPreviewOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && PREVIEW_HOST.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Decide the builder origin from the (already-detected) top-level page origin.
 * Pure, so it's the unit-test seam. Only a PR-preview deploy is adopted; every
 * other origin — prod, cli, dev, a sandbox subdomain, a stable-entry backend, a
 * third-party embed, or none at all — routes to the public {@link
 * VIBES_DIY_BUILDER_URL}, so no internal host can leak.
 */
export function resolveBuilderOriginFrom(topOrigin: string | undefined): string {
  return topOrigin && isPreviewOrigin(topOrigin) ? topOrigin : VIBES_DIY_BUILDER_URL;
}

// The vibe runs in a cross-origin sandboxed iframe, so it can't read
// `window.top.location`. `ancestorOrigins` exposes the ancestor chain's origins
// cross-origin (Chromium/WebKit); the last entry is the top builder page. Fall
// back to the referrer origin (Firefox has no ancestorOrigins), then undefined.
function detectTopOrigin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const ao = window.location.ancestorOrigins;
    if (ao && ao.length > 0) return ao.item(ao.length - 1) ?? undefined;
  } catch {
    /* ancestorOrigins unsupported — fall through to referrer */
  }
  try {
    if (typeof document !== "undefined" && document.referrer) return new URL(document.referrer).origin;
  } catch {
    /* malformed referrer — fall through */
  }
  return undefined;
}

/** The builder origin this vibe should hand off to (prod, or the PR preview it runs under). */
export function resolveBuilderOrigin(): string {
  return resolveBuilderOriginFrom(detectTopOrigin());
}

/**
 * Base64 inflates the prompt by ~4/3 and the encoded value rides in a query
 * param, so cap the whole URL well under the ~8 KB practical limit that older
 * browsers / proxies impose. Phase 2 (POST the prompt, redirect to `?pending=`)
 * removes this ceiling without changing any call site — only this helper's body
 * changes. Until then, over-threshold hand-offs warn but still proceed.
 */
export const CREATE_VIBE_SAFE_URL_LENGTH = 6000;

export interface CreateVibeOptions {
  /** Override the safe-URL-length warning threshold (default {@link CREATE_VIBE_SAFE_URL_LENGTH}). */
  readonly maxUrlLength?: number;
}

/**
 * Build the builder hand-off URL for `prompt`. The builder origin is resolved
 * automatically ({@link resolveBuilderOrigin}) — prod by default, or the PR
 * preview the vibe is running under. Performs no navigation, so it's safe to
 * call during render (e.g. to populate an `<a href>` fallback).
 */
export function buildCreateVibeUrl(prompt: string): string {
  // `/chat/prompt` is the route that actually consumes `prompt64`; the bare
  // homepage (`/`) ignores the param. URL/searchParams percent-encodes the
  // base64 value so `+` `/` `=` survive the query string intact.
  const url = new URL("/chat/prompt", resolveBuilderOrigin());
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
  const { maxUrlLength = CREATE_VIBE_SAFE_URL_LENGTH } = options;
  const url = buildCreateVibeUrl(prompt);

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
