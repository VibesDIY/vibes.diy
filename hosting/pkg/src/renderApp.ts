import { Hono, Context } from "hono";
import { parseSubdomain, isValidSubdomain } from "./utils/subdomainParser";
import { renderAppInstance, renderCatalogTitle } from "./utils/appRenderer";
import {
  isCustomDomain,
  isFirstPartyApexDomain,
  getFirstPartyDomain,
} from "./utils/domainUtils";
import testAppData from "../test-app-data.json";
// We'll use a different approach for serving the favicons

interface Bindings {
  KV: KVNamespace;
  SERVER_OPENROUTER_PROV_KEY: string;
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

    // Route based on whether this is an instance (has underscore) or catalog title (no underscore)
    if (debugParsed.isInstance) {
      // Render app instance using existing logic
      return renderAppInstance(c, debugParsed, testAppData);
    } else {
      // Render catalog title page
      return renderCatalogTitle(c, debugParsed, testAppData);
    }
  }

  // First, check if this is a custom domain
  let effectiveHostname = hostname;
  let customDomain = null;
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
    return c.redirect("https://vibes.diy", 301);
  }

  // Handle apex domain redirects
  if (parsed.appSlug === "www" || isFirstPartyApexDomain(hostname)) {
    return c.redirect("https://vibes.diy", 301);
  }

  // Look up the app in KV
  const appData = await kv.get(parsed.appSlug);

  if (!appData) {
    return c.notFound();
  }

  // Parse the app data
  const app = JSON.parse(appData);

  // Route based on whether this is an instance (has underscore) or catalog title (no underscore)
  if (parsed.isInstance) {
    // Render app instance - pass custom domain and original domain
    return renderAppInstance(c, parsed, app, customDomain, originalDomain);
  } else {
    // Render catalog title page with original domain
    return renderCatalogTitle(c, parsed, app, originalDomain);
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

  // Extract the original first-party domain for preservation
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
    return c.redirect("https://vibes.diy", 301);
  }

  // Handle apex domain redirects
  if (parsed.appSlug === "www") {
    return c.redirect("https://vibes.diy", 301);
  }

  // Try to find the app in KV using the app slug as the key
  const appData = await kv.get(parsed.appSlug);

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

// Shared screenshot handler logic
async function handleScreenshotRequest(c: Context, includeBody = true) {
  // Extract subdomain from the request URL
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  // Get the KV namespace from the context
  const kv = c.env.KV;

  // Extract the original first-party domain for preservation
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
    return c.redirect("https://vibes.diy", 301);
  }

  // Handle apex domain redirects
  if (parsed.appSlug === "www") {
    return c.redirect("https://vibes.diy", 301);
  }

  // Calculate screenshot key based on app slug (screenshots are always for the base app)
  const screenshotKey = `${parsed.appSlug}-screenshot`;

  // Get the screenshot from KV
  const screenshot = await kv.get(screenshotKey, "arrayBuffer");

  if (!screenshot) {
    return c.notFound();
  }

  const fileSize = screenshot.byteLength;
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
          "Content-Type": "image/png",
        },
      });
    }

    const { start, end } = range;
    const contentLength = end - start + 1;
    const chunk = screenshot.slice(start, end + 1);

    const headers = {
      "Content-Type": "image/png",
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
    "Content-Type": "image/png",
    "Content-Length": fileSize.toString(),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  };

  // Return the screenshot with proper headers, optionally including body
  return new Response(includeBody ? screenshot : null, { headers });
}

// Route to serve app screenshots as PNG images (GET and HEAD)
app.all("/screenshot.png", async (c) => {
  const method = c.req.method;
  if (method === "GET") {
    return handleScreenshotRequest(c, true);
  } else if (method === "HEAD") {
    return handleScreenshotRequest(c, false);
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
