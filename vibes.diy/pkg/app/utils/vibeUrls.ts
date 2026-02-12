import { BuildURI } from "@adviser/cement";

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
 * Construct URL for vibe icon with query parameter
 */
export function constructVibeIconUrl(slug: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/icon.png").setParam("slug", slug).toString();
}
