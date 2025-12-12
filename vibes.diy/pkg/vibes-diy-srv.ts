import {
  loadAndRenderTSX,
  loadAndRenderJSX,
  renderScript,
} from "./lib/render.ts";
import { contentType } from "mime-types";
import { getClerkKeyForHostname } from "./clerk-env.ts";
import { Lazy } from "@adviser/cement";

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
  req: Request,
  globalProps: Record<string, unknown>,
): Promise<Response | null> {
  // Handle /vibe/{appSlug}/{groupId} routes (both required)
  const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)\/([^/]+)/);
  if (!vibeMatch) {
    return null; // Not a vibe route
  }

  const appSlug = vibeMatch[1];
  const groupId = vibeMatch[2];

  try {
    const vibeCode = await fetchVibeCode(appSlug);

    // Transform JSX → JS (externalized imports)
    const transformedJS = await loadAndRenderJSX(vibeCode);

    // Get Clerk key for this hostname
    const hostname = new URL(req.url).hostname;
    const clerkPublishableKey = getClerkKeyForHostname(hostname);

    // Render vibe.tsx template with transformed JS
    const vibePath = `${Deno.cwd()}/vibe.tsx`;
    const html = await loadAndRenderTSX(vibePath, {
      ...globalProps,
      appSlug,
      groupId,
      transformedJS,
      clerkPublishableKey,
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

const globalProps = Lazy(async () => {
  const packageJsonStr = await Deno.readTextFile(`package.json`);
  const packageJson = JSON.parse(packageJsonStr);
  const FP = (
    packageJson.dependencies["@fireproof/core-cli"] ??
    packageJson.devDependencies["@fireproof/core-cli"]
  ).replace(/^[^0-9]*/, "");
  console.log("Fireproof-Version:", FP);
  return { versions: { FP } };
});

Deno.serve({ port: 8001 }, async (req) => {
  const url = new URL(req.url);
  const requestedPath = url.pathname;

  if (url.pathname === "/vibe-mount") {
    const appSlug = url.searchParams.get("appSlug");
    if (!appSlug) {
      return new Response(
        JSON.stringify({ error: "Missing appSlug parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    // const x = await loadAndRenderJSX(`<MountVibe appSlug="${appSlug}" />`)
    // console.log(x)
    return new Response(
      `
        import { mountVibe } from '/dist/vibes.diy/pkg/serve/mount-vibe.js';
        import vibe from '/vibe-script?appSlug=${appSlug}';
        mountVibe(vibe, { appSlug: '${appSlug}' });
        `,
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
  if (url.pathname === "/vibe-script") {
    const appSlug = url.searchParams.get("appSlug");
    if (!appSlug) {
      return new Response(
        JSON.stringify({ error: "Missing appSlug parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const vibeCode = await fetchVibeCode(appSlug);
    const transformedJS = await loadAndRenderJSX(vibeCode);
    return new Response(transformedJS, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Check if this is a vibe route
  const vibeResponse = await handleVibeRequest(
    requestedPath,
    req,
    await globalProps(),
  );
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
    const html = await loadAndRenderTSX(indexPath, await globalProps());

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
