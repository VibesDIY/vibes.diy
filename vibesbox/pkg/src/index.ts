/**
 * Vibebox: Simple Cloudflare Worker Implementation
 * Serves static iframe.html content for secure, isolated iframe hosting
 * Also handles /vibe/{slug} pattern with postMessage communication
 */

import iframeHtml from "./iframe.html";
import wrapperHtml from "./wrapper.html";
import labHtml from "./lab.html";

export interface Env {
  // Add any environment variables here
}

const DEFAULT_VIBE_SLUG = "quick-cello-8104";
const DEFAULT_FIREPROOF_VERSION = "0.23.14";
const FIREPROOF_VERSION_PARAM = "v_fp";
const FIREPROOF_VERSION_PLACEHOLDER = "{{FIREPROOF_VERSION}}";

/**
 * Validate semver format
 */
function isValidSemver(version: string | null): boolean {
  if (!version) return false;
  const semverPattern =
    /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
  return semverPattern.test(version);
}

/**
 * Get fireproof version from URL parameter with validation
 */
function getFireproofVersion(url: URL): string {
  const versionParam = url.searchParams.get(FIREPROOF_VERSION_PARAM);
  return isValidSemver(versionParam)
    ? versionParam!
    : DEFAULT_FIREPROOF_VERSION;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle /lab/{slug} pattern
    if (url.pathname.startsWith("/lab/") || url.pathname === "/lab") {
      const pathSegments = url.pathname.split("/");
      const slug = pathSegments[2] || DEFAULT_VIBE_SLUG;

      return handleLabPage(slug, url.origin, url);
    }

    // Handle /vibe/{slug} pattern
    if (url.pathname.startsWith("/vibe/") || url.pathname === "/vibe") {
      const pathSegments = url.pathname.split("/");
      const slug = pathSegments[2] || DEFAULT_VIBE_SLUG;

      return handleVibeWrapper(slug, url.origin, url);
    }

    // Default: Return the static iframe HTML content with dynamic fireproof version
    const fireproofVersion = getFireproofVersion(url);
    const html = iframeHtml.replaceAll(
      FIREPROOF_VERSION_PLACEHOLDER,
      fireproofVersion,
    );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "X-Frame-Options": "ALLOWALL",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};

/**
 * Handle /vibe/{slug} requests with wrapper that uses postMessage
 */
async function handleVibeWrapper(
  slug: string,
  origin: string,
  url: URL,
): Promise<Response> {
  // Get fireproof version and pass to iframe via URL parameter
  const fireproofVersion = getFireproofVersion(url);
  const iframeSrc =
    fireproofVersion !== DEFAULT_FIREPROOF_VERSION
      ? `/?${FIREPROOF_VERSION_PARAM}=${encodeURIComponent(fireproofVersion)}`
      : "/";

  // Replace template placeholders
  const html = wrapperHtml
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{origin}}", origin)
    .replaceAll("{{iframeSrc}}", iframeSrc);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=300", // Shorter cache for dynamic content
    },
  });
}

/**
 * Handle /lab/{slug} requests with multi-iframe test environment
 */
async function handleLabPage(
  slug: string,
  origin: string,
  _url: URL,
): Promise<Response> {
  // Replace template placeholders
  const html = labHtml
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{origin}}", origin);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=300", // Shorter cache for dynamic content
    },
  });
}
