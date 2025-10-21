/**
 * Vibebox: Simple Cloudflare Worker Implementation
 * Serves static iframe.html content for secure, isolated iframe hosting
 * Also handles /vibe/{slug} pattern with postMessage communication
 */

import iframeHtml from "./iframe-template";
import wrapperHtml from "./wrapper-template";
import labHtml from "./lab-template";
import {
  DEFAULT_VIBE_SLUG,
  DEFAULT_FIREPROOF_VERSION,
  FIREPROOF_VERSION_PARAM,
  FIREPROOF_VERSION_PLACEHOLDER,
  isValidSemver,
  getFireproofVersion,
  replacePlaceholders,
} from "./utilities";
import { libraryImportMap } from "@vibes.diy/hosting-base/config/library-import-map";

export interface Env {
  // Add any environment variables here
}

// Re-export utilities for testing
// Named exports removed - Cloudflare Workers require only default export with fetch handler

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isHead = request.method === "HEAD";

    // Handle /import-map.json endpoint
    if (url.pathname === "/import-map.json") {
      const response = await handleImportMapRequest(url);
      if (isHead) {
        return new Response("", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      return response;
    }

    // Handle /lab/{slug} pattern
    if (url.pathname.startsWith("/lab/") || url.pathname === "/lab") {
      const pathSegments = url.pathname.split("/");
      const slug = pathSegments[2] || DEFAULT_VIBE_SLUG;

      const response = await handleLabPage(slug, url.origin, url);
      if (isHead) {
        return new Response("", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      return response;
    }

    // Handle /vibe/{slug} pattern
    if (url.pathname.startsWith("/vibe/") || url.pathname === "/vibe") {
      const pathSegments = url.pathname.split("/");
      const slug = pathSegments[2] || DEFAULT_VIBE_SLUG;

      const response = await handleVibeWrapper(slug, url.origin, url);
      if (isHead) {
        return new Response("", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      return response;
    }

    // Default: Return the static iframe HTML content with dynamic fireproof version
    const fireproofVersion = getFireproofVersion(url);
    const html = replacePlaceholders(iframeHtml, {
      [FIREPROOF_VERSION_PLACEHOLDER]: fireproofVersion,
    });

    return new Response(isHead ? "" : html, {
      status: 200,
      statusText: "OK",
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
export async function handleVibeWrapper(
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
  const html = replacePlaceholders(wrapperHtml, {
    "{{slug}}": slug,
    "{{origin}}": origin,
    "{{iframeSrc}}": iframeSrc,
  });

  return new Response(html, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=300", // Shorter cache for dynamic content
    },
  });
}

/**
 * Handle /lab/{slug} requests with multi-iframe test environment
 */
export async function handleLabPage(
  slug: string,
  origin: string,
  _url: URL,
): Promise<Response> {
  // Replace template placeholders
  const html = replacePlaceholders(labHtml, {
    "{{slug}}": slug,
    "{{origin}}": origin,
  });

  return new Response(html, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=300", // Shorter cache for dynamic content
    },
  });
}

/**
 * Handle /import-map.json requests with optional v_vibes version override
 */
export async function handleImportMapRequest(url: URL): Promise<Response> {
  // Parse v_vibes parameter for version override
  const versionParam = (url.searchParams.get("v_vibes") || "").trim();
  const semverPattern =
    /^[0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/;
  const vibesVersion = semverPattern.test(versionParam) ? versionParam : "";

  // Create dynamic import map with optional version override
  const dynamicImportMap = { ...libraryImportMap.imports };
  if (vibesVersion) {
    dynamicImportMap["use-vibes"] = `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["use-fireproof"] =
      `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["call-ai"] = `https://esm.sh/call-ai@${vibesVersion}`;
  }

  const importMapJson = JSON.stringify({ imports: dynamicImportMap }, null, 2);

  return new Response(importMapJson, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
