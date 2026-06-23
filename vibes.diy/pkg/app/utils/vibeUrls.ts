import { BuildURI } from "@adviser/cement";

export function getAppHostBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: allow env override for worker contexts
  const baseUrl = process.env.APP_HOST_BASE_URL;
  if (baseUrl) {
    return baseUrl;
  }

  return "";
}

/**
 * Construct URL for vibe code endpoint with query parameter
 */
export function constructVibeCodeUrl(slug: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/App.jsx").setParam("slug", slug).toString();
}

/**
 * Construct URL for vibe screenshot with query parameter
 */
export function constructVibeScreenshotUrl(slug: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/screenshot.png").setParam("slug", slug).toString();
}

/**
 * Legacy stub from the removed hosting/ worker. The /icon.png endpoint never
 * landed on the v2 stack, so PublishedVibeCard 404s on this URL and falls back
 * to the screenshot. Retained to keep that fallback path working until
 * PublishedVibeCard is migrated to the cidAsset-backed icon flow.
 */
export function constructVibeIconUrl(slug: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/icon.png").setParam("slug", slug).toString();
}

/**
 * Construct URL for a content-addressed asset served by the cidAsset endpoint.
 */
export function cidAssetUrl(cid: string, mime: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/assets/cid").setParam("url", cid).setParam("mime", mime).toString();
}

/**
 * Public preview image for a published vibe, served by the runtime host
 * (`appSlug--ownerHandle.<hostnameBase>`). This is the same URL the /vibe/
 * viewer exposes as its `og:image`, so it's the canonical image to hand to
 * social-share surfaces (e.g. Pinterest pins, which are image-first).
 */
export function vibeScreenshotImageUrl({
  ownerHandle,
  appSlug,
  hostnameBase,
}: {
  ownerHandle: string;
  appSlug: string;
  hostnameBase: string;
}): string {
  // The env-supplied base may carry a leading dot (".vibes.diy"); drop it so the
  // host matches the viewer's og:image construction.
  const base = hostnameBase.replace(/^\./, "");
  return `https://${appSlug}--${ownerHandle}.${base}/screenshot.jpg`;
}

/**
 * Build a Pinterest "Save"/pin-create URL. Opening it pops Pinterest's own
 * save dialog so the viewer can pin the vibe to one of their boards — no
 * Pinterest API key or login on our side. Pins are image-first, so this only
 * makes sense for published, publicly-viewable vibes (the `media` image must be
 * publicly fetchable).
 */
export function buildPinterestShareUrl({
  pageUrl,
  imageUrl,
  description,
}: {
  pageUrl: string;
  imageUrl: string;
  description: string;
}): string {
  return BuildURI.from("https://www.pinterest.com/pin/create/button/")
    .setParam("url", pageUrl)
    .setParam("media", imageUrl)
    .setParam("description", description)
    .toString();
}
