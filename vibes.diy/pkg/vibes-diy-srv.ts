import { loadAndRenderTSX, loadAndRenderJSX } from "./lib/render.js";
import { contentType } from "mime-types";

async function fetchVibeCode(appSlug: string): Promise<string> {
  // Fetch vibe code from hosting subdomain App.jsx endpoint
  const response = await fetch(`https://${appSlug}.vibesdiy.app/App.jsx`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vibe: ${response.statusText}`);
  }
  return await response.text();
}

async function handleVibeRequest(
  requestedPath: string,
): Promise<Response | null> {
  // Handle /vibe/{appSlug} or /vibe/{appSlug}/{groupId} routes
  const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)(?:\/([^/]+))?/);
  if (!vibeMatch) {
    return null; // Not a vibe route
  }

  const appSlug = vibeMatch[1];
  const groupId = vibeMatch[2];

  try {
    const vibeCode = await fetchVibeCode(appSlug);

    // Transform JSX → JS (externalized imports)
    const transformedJS = await loadAndRenderJSX(vibeCode);

    // Render vibe.tsx template with transformed JS
    const vibePath = `${Deno.cwd()}/vibe.tsx`;
    const html = await loadAndRenderTSX(vibePath, {
      appSlug,
      groupId,
      transformedJS,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

Deno.serve({ port: 8001 }, async (req) => {
  const url = new URL(req.url);
  const requestedPath = url.pathname;

  // Check if this is a vibe route
  const vibeResponse = await handleVibeRequest(requestedPath);
  if (vibeResponse) {
    return vibeResponse;
  }

  // Map request path to local filesystem
  const cwd = Deno.cwd();
  const localPath = `${cwd}${requestedPath}`;

  // First, try to serve static file from disk
  try {
    const fileInfo = await Deno.stat(localPath);

    if (fileInfo.isFile) {
      const content = await Deno.readFile(localPath);
      const ext = requestedPath.substring(requestedPath.lastIndexOf("."));
      const mimeType = contentType(ext) || "application/octet-stream";

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (_error) {
    // File not found, continue to TSX rendering
  }

  // If no static file found, render index.tsx
  try {
    const indexPath = `${cwd}/index.tsx`;
    const html = await loadAndRenderTSX(indexPath);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("TSX render server running on http://localhost:8001");
console.log("Usage: http://localhost:8001?file=/path/to/component.tsx");
