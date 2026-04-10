import { BuildURI } from "@adviser/cement";

export function getAppHostBaseUrl(): string {
  if (typeof process !== "undefined") {
    const baseUrl = process.env.VITE_APP_HOST_BASE_URL ?? process.env.APP_HOST_BASE_URL;
    if (baseUrl) {
      return baseUrl;
    }
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "https://vibesdiy.app";
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
 * Construct URL for vibe icon with query parameter
 */
export function constructVibeIconUrl(slug: string, appHostBaseUrl: string): string {
  return BuildURI.from(appHostBaseUrl).pathname("/icon.png").setParam("slug", slug).toString();
}
