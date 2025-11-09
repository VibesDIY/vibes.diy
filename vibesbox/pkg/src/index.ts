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
  VIBES_VERSION_PARAM,
  IMPORT_MAP_PLACEHOLDER,
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

    // Handle /vibe/{titleId}/{uuid} pattern
    if (url.pathname.startsWith("/vibe/") || url.pathname === "/vibe") {
      const pathSegments = url.pathname.split("/").filter((s) => s);
      const titleId = pathSegments[1] || DEFAULT_VIBE_SLUG;
      const uuid = pathSegments[2]; // Optional UUID

      const response = await handleVibeWrapper(titleId, uuid, url.origin, url);
      if (isHead) {
        return new Response("", {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      return response;
    }

    // Default: Return the static iframe HTML content with dynamic versions
    // Extract version parameter from URL for use-vibes override (same as hosting)
    const versionParam = (
      url.searchParams.get(VIBES_VERSION_PARAM) || ""
    ).trim();
    const semverPattern =
      /^[0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/;
    const vibesVersion = semverPattern.test(versionParam) ? versionParam : "";

    // Clone the library import map and update use-vibes version if specified
    const dynamicImportMap = { ...libraryImportMap.imports };
    if (vibesVersion) {
      dynamicImportMap["use-vibes"] =
        `https://esm.sh/use-vibes@${vibesVersion}`;
      dynamicImportMap["use-fireproof"] =
        `https://esm.sh/use-vibes@${vibesVersion}`;
      dynamicImportMap["https://esm.sh/use-fireproof"] =
        `https://esm.sh/use-vibes@${vibesVersion}`;
      dynamicImportMap["call-ai"] = `https://esm.sh/call-ai@${vibesVersion}`;
    }

    const importMapJson = JSON.stringify(
      { imports: dynamicImportMap },
      null,
      2,
    );

    const html = replacePlaceholders(iframeHtml, {
      [IMPORT_MAP_PLACEHOLDER]: importMapJson,
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
 * Handle /vibe/{titleId}/{uuid} requests with wrapper that uses postMessage
 */
export async function handleVibeWrapper(
  titleId: string,
  uuid: string | undefined,
  origin: string,
  url: URL,
): Promise<Response> {
  // Forward v_vibes parameter to iframe if present
  const versionParam = url.searchParams.get(VIBES_VERSION_PARAM);
  const iframeSrc = versionParam
    ? `/?${VIBES_VERSION_PARAM}=${encodeURIComponent(versionParam)}`
    : "/";

  // Replace template placeholders
  const html = replacePlaceholders(wrapperHtml, {
    "{{slug}}": titleId, // Keep for backward compatibility
    "{{titleId}}": titleId,
    "{{uuid}}": uuid || "",
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
