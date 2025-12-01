import { Hono, Context } from "hono";
import { URI } from "@adviser/cement";
import {
  parseSubdomain,
  isValidSubdomain,
  isCustomDomain,
  isFirstPartyApexDomain,
  getFirstPartyDomain,
} from "@vibes.diy/hosting-base";
import { testAppData } from "../test-app-data.js";

interface Bindings {
  KV: KVNamespace;
  SERVER_OPENROUTER_API_KEY: string;
  PUBLISH_QUEUE: Queue;
}
// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
  // Extract subdomain from the request URL
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  // Get the KV namespace from the context
  const kv = c.env.KV;

  // Extract the original first-party domain for preservation
  const originalDomain = getFirstPartyDomain(hostname) || "vibesdiy.app";

  // Check for preview flag (for local testing)
  const preview = url.searchParams.get("preview");
  if (preview === "title" || preview === "app") {
    // Use local test app data
    let debugSubdomain;

    if (preview === "app") {
      // For app instance mode, append an underscore and install ID
      debugSubdomain = `${testAppData.slug}_debug.vibesdiy.app`;
    } else {
      // For catalog mode (preview=title)
      debugSubdomain = `${testAppData.slug}.vibesdiy.app`;
    }

    const debugParsed = parseSubdomain(debugSubdomain);

    // Redirect to new path-based URL
    if (debugParsed.isInstance && debugParsed.installId) {
      return c.redirect(
        URI.from(
          `https://vibes.diy/vibe/${debugParsed.appSlug}/${debugParsed.installId}`,
        ).toString(),
        302,
      );
    } else {
      return c.redirect(
        URI.from(`https://vibes.diy/vibe/${debugParsed.appSlug}`).toString(),
        302,
      );
    }
  }

  // First, check if this is a custom domain
  let effectiveHostname = hostname;
  let customDomain: string | undefined = undefined;
  const customDomainMapping = await kv.get(`domain:${hostname}`);

  if (customDomainMapping) {
    if (isCustomDomain(hostname)) {
      // This is a custom domain
      if (customDomainMapping.includes("_")) {
        // Mapping already specifies an instance (e.g., "my-app_abc123"), use as-is
        effectiveHostname = `${customDomainMapping}.${originalDomain}`;
      } else {
        // Mapping is just an app slug (e.g., "my-app"), add _origin for instance
        effectiveHostname = `${customDomainMapping}_origin.${originalDomain}`;
      }
      customDomain = hostname;
    } else {
      // This is a mapped vibesdiy domain, use regular mapping
      effectiveHostname = `${customDomainMapping}.${originalDomain}`;
    }
  }

  // Parse the subdomain using our new parser
  const parsed = parseSubdomain(effectiveHostname);

  // Validate the parsed subdomain
  if (!isValidSubdomain(parsed)) {
    return c.redirect(URI.from("https://vibes.diy").toString(), 301);
  }

  // Handle apex domain redirects
  if (parsed.appSlug === "www" || isFirstPartyApexDomain(hostname)) {
    return c.redirect(URI.from("https://vibes.diy").toString(), 301);
  }

  // Look up the app in KV
  const appData = await kv.get(parsed.appSlug);

  if (!appData) {
    return c.notFound();
  }

  // Parse the app data
  const app = JSON.parse(appData);

  // Redirect to new path-based URL format
  if (parsed.isInstance && parsed.installId) {
    // Instance URL: redirect to https://vibes.diy/vibe/{slug}/{installId}
    return c.redirect(
      URI.from(
        `https://vibes.diy/vibe/${parsed.appSlug}/${parsed.installId}`,
      ).toString(),
      302,
    );
  } else {
    // Catalog URL: redirect to https://vibes.diy/vibe/{slug}
    return c.redirect(
      URI.from(`https://vibes.diy/vibe/${parsed.appSlug}`).toString(),
      302,
    );
  }
});

// Handle OPTIONS requests for CORS preflight checks
app.options("/App.jsx", () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-vibes-token",
      "Access-Control-Max-Age": "86400",
    },
  });
});

// Route to return just the raw JS content without the HTML template
app.get("/App.jsx", async (c) => {
  // Extract subdomain from the request URL
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  // Get the KV namespace from the context
  const kv = c.env.KV;

  // Check for slug query parameter first
  const slugParam = url.searchParams.get("slug");

  let appSlug: string;

  if (slugParam) {
    // Use slug from query parameter
    appSlug = slugParam;
  } else {
    // Fall back to subdomain parsing
    const originalDomain = getFirstPartyDomain(hostname) || "vibesdiy.app";

    // First, check if this is a custom domain
    let effectiveHostname = hostname;
    const customDomainMapping = await kv.get(`domain:${hostname}`);

    if (customDomainMapping) {
      // This is a custom domain, use the mapped subdomain + original domain
      effectiveHostname = `${customDomainMapping}.${originalDomain}`;
    }

    // Parse the subdomain using our new parser
    const parsed = parseSubdomain(effectiveHostname);

    // Validate the parsed subdomain
    if (!isValidSubdomain(parsed)) {
      return c.redirect(URI.from("https://vibes.diy").toString(), 301);
    }

    // Handle apex domain redirects
    if (parsed.appSlug === "www") {
      return c.redirect(URI.from("https://vibes.diy").toString(), 301);
    }

    appSlug = parsed.appSlug;
  }

  // Try to find the app in KV using the app slug as the key
  const appData = await kv.get(appSlug);

  if (!appData) {
    return c.notFound();
  }

  // Parse the app data
  const app = JSON.parse(appData);

  // Return just the raw app code (preferring app.raw if it exists, falling back to app.code)
  const rawCode = app.raw || app.code;

  // Set the content type to JavaScript and add CORS headers
  return new Response(rawCode, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-vibes-token",
    },
  });
});

// Parse Range header to extract start and end byte positions
function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate range
  if (start < 0 || start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

function detectImageContentType(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return "application/octet-stream";
}

// Shared image asset handler logic (screenshots/icons)
async function handleImageRequest(
  c: Context,
  keySuffix: string,
  includeBody = true,
) {
  // Extract subdomain from the request URL
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  // Get the KV namespace from the context
  const kv = c.env.KV;

  // Check for slug query parameter first
  const slugParam = url.searchParams.get("slug");

  let appSlug: string;

  if (slugParam) {
    // Use slug from query parameter
    appSlug = slugParam;
  } else {
    // Fall back to subdomain parsing
    const originalDomain = getFirstPartyDomain(hostname) || "vibesdiy.app";

    // First, check if this is a custom domain
    let effectiveHostname = hostname;
    const customDomainMapping = await kv.get(`domain:${hostname}`);

    if (customDomainMapping) {
      // This is a custom domain, use the mapped subdomain + original domain
      effectiveHostname = `${customDomainMapping}.${originalDomain}`;
    }

    // Parse the subdomain using our new parser
    const parsed = parseSubdomain(effectiveHostname);

    // Validate the parsed subdomain
    if (!isValidSubdomain(parsed)) {
      return c.redirect(URI.from("https://vibes.diy").toString(), 301);
    }

    // Handle apex domain redirects
    if (parsed.appSlug === "www") {
      return c.redirect(URI.from("https://vibes.diy").toString(), 301);
    }

    appSlug = parsed.appSlug;
  }

  // Calculate asset key based on app slug
  const assetKey = `${appSlug}-${keySuffix}`;

  // Get the asset from KV
  const asset = await kv.get(assetKey, "arrayBuffer");

  if (!asset) {
    // If icon is missing but app exists, enqueue a repair
    if (keySuffix === "icon") {
      const repairFlagKey = `${appSlug}-icon-repair`;

      // Check if already under repair
      const underRepair = await kv.get(repairFlagKey);

      if (!underRepair) {
        // Check if app record exists
        const appData = await kv.get(appSlug);

        if (appData) {
          // Set under-repair flag immediately to prevent duplicate repairs
          await kv.put(repairFlagKey, "true", { expirationTtl: 3600 }); // 1 hour expiry

          try {
            const app = JSON.parse(appData);
            // Enqueue repair event
            await c.env.PUBLISH_QUEUE.send({
              type: "icon_repair",
              app,
              metadata: {
                timestamp: Date.now(),
                isUpdate: false,
              },
            });
          } catch (error) {
            console.error(
              `Failed to enqueue icon repair for ${appSlug}:`,
              error,
            );
          }
        }
      }
    }

    return c.notFound();
  }

  const fileSize = asset.byteLength;
  const contentType = detectImageContentType(asset);
  const rangeHeader = c.req.header("Range");

  // Handle Range requests
  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, fileSize);

    if (!range) {
      // Invalid range - return 416 Range Not Satisfiable
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const { start, end } = range;
    const contentLength = end - start + 1;
    const chunk = asset.slice(start, end + 1);

    const headers = {
      "Content-Type": contentType,
      "Content-Length": contentLength.toString(),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    };

    return new Response(includeBody ? chunk : null, {
      status: 206,
      headers,
    });
  }

  // Standard GET/HEAD request - return full file
  const headers = {
    "Content-Type": contentType,
    "Content-Length": fileSize.toString(),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  };

  // Return the asset with proper headers, optionally including body
  return new Response(includeBody ? asset : null, { headers });
}

// Route to serve app screenshots as PNG images (GET and HEAD)
app.all("/screenshot.png", async (c) => {
  const method = c.req.method;
  if (method === "GET") {
    return handleImageRequest(c, "screenshot", true);
  } else if (method === "HEAD") {
    return handleImageRequest(c, "screenshot", false);
  } else {
    return c.json({ error: "Method not allowed" }, 405);
  }
});

// Route to serve app icons as PNG images (GET and HEAD)
app.all("/icon.png", async (c) => {
  const method = c.req.method;
  if (method === "GET") {
    return handleImageRequest(c, "icon", true);
  } else if (method === "HEAD") {
    return handleImageRequest(c, "icon", false);
  } else {
    return c.json({ error: "Method not allowed" }, 405);
  }
});

// Route to serve favicon.svg
app.get("/favicon.svg", async (c) => {
  // Read the favicon.svg file from KV or serve it from a static file
  const faviconData = await c.env.KV.get("favicon.svg", "arrayBuffer");

  if (faviconData) {
    return new Response(faviconData, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=2592000",
      },
    });
  }

  // If not in KV, fetch from your src directory (first deployment)
  // In real-world, you'd upload these to KV during deployment
  return c.notFound();
});

// Route to serve favicon.ico
app.get("/favicon.ico", async (c) => {
  // Read the favicon.ico file from KV or serve it from a static file
  const faviconData = await c.env.KV.get("favicon.ico", "arrayBuffer");

  if (faviconData) {
    return new Response(faviconData, {
      headers: {
        "Content-Type": "image/x-icon",
        "Cache-Control": "public, max-age=2592000",
      },
    });
  }

  // If not in KV, fetch from your src directory (first deployment)
  // In real-world, you'd upload these to KV during deployment
  return c.notFound();
});

// Route to serve babel.min.js
app.get("/babel.min.js", async (c) => {
  const babel = await c.env.KV.get("babel-standalone");
  if (!babel) {
    return c.text("Babel not found", 404);
  }
  return c.text(babel, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=86400", // Cache for 24 hours
  });
});

export default app;
