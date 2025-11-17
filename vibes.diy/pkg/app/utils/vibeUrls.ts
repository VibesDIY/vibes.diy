import { VibesDiyEnv } from "../config/env.js";

/**
 * Construct URL for vibe code endpoint with query parameter
 */
export function constructVibeCodeUrl(slug: string): string {
  const baseUrl = new URL(VibesDiyEnv.APP_HOST_BASE_URL());
  baseUrl.pathname = "/App.jsx";
  baseUrl.searchParams.set("slug", slug);
  return baseUrl.href;
}

/**
 * Construct URL for vibe screenshot with query parameter
 */
export function constructVibeScreenshotUrl(slug: string): string {
  const baseUrl = new URL(VibesDiyEnv.APP_HOST_BASE_URL());
  baseUrl.pathname = "/screenshot.png";
  baseUrl.searchParams.set("slug", slug);
  return baseUrl.href;
}
