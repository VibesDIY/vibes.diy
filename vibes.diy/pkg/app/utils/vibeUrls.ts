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
