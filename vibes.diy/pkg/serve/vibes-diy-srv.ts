import {
  loadAndRenderTSX,
  loadAndRenderJSX,
  VibesDiyServCtx,
} from "./render.js";
// import { contentType } from "mime-types";
import mime from "mime";
import { getClerkKeyForHostname } from "../clerk-env.js";
import { uint8array2stream } from "@adviser/cement";

async function fetchVibeCode(appSlug: string): Promise<string> {
  // Fetch vibe code from hosting subdomain App.jsx endpoint
  const response = await fetch(`https://${appSlug}.vibesdiy.app/App.jsx`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vibe: ${response.statusText}`);
  }
  return await response.text();
}

async function handleVibeRequest(
  req: Request,
  ctx: VibesDiyServCtx & {
    appSlug: string;
    groupId: string;
  },
): Promise<Response | null> {
  const { appSlug } = ctx;
  try {
    const vibeCode = await fetchVibeCode(appSlug);

    // Transform JSX → JS (externalized imports)
    const transformedJS = await loadAndRenderJSX(vibeCode);

    // Get Clerk key for this hostname
    const hostname = new URL(req.url).hostname;
    const clerkPublishableKey = getClerkKeyForHostname(hostname);

    // Render vibe.tsx template with transformed JS
    const vibePath = `./vibe.tsx`;
    const html = await loadAndRenderTSX(vibePath, {
      ...ctx,
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

function respInit(status: number, contentType = "application/json"): ResponseInit {
  return {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": contentType,
    },
  };
}

export function vibesDiyHandler(
  ctx: () => Promise<VibesDiyServCtx>,
): (req: Request) => Promise<Response | null> {
  return async (req: Request) => {
    const url = new URL(req.url);
    const requestedPath = url.pathname;

    if (url.pathname === "/vibe-mount") {
      const appSlug = url.searchParams.get("appSlug");
      if (!appSlug) {
        return new Response(JSON.stringify({ error: "Missing appSlug parameter" }), respInit(400));
      }
      const env = await ctx().then((c) => c.vibesCtx.env);

      const ctxStr = JSON.stringify({ appSlug, env });
      return new Response(
        `import { mountVibe } from '/dist/vibes.diy/pkg/serve/mount-vibe.js';
         import vibe from '/vibe-script?appSlug=${appSlug}';
         mountVibe(vibe, ${ctxStr});
        `, respInit(200, "text/javascript")
      );
    }
    if (url.pathname === "/vibe-script") {
      const appSlug = url.searchParams.get("appSlug");
      if (!appSlug) {
        return new Response(
          JSON.stringify({ error: "Missing appSlug parameter" }),
          respInit(400),
        );
      }
      const vibeCode = await fetchVibeCode(appSlug);
      const transformedJS = await loadAndRenderJSX(vibeCode);
      return new Response(transformedJS, respInit(200, "text/javascript"));
    }

    // Handle /vibe/{appSlug}/{groupId} routes (both required)
    const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)\/([^/]+)/);
    if (vibeMatch) {
      const vibeResponse = handleVibeRequest(req, {
        appSlug: vibeMatch[1],
        groupId: vibeMatch[2],
        ...(await ctx()),
      });
      return vibeResponse;
    }

    // Map request path to local filesystem
    // const cwd = Deno.cwd();
    const localPath = `./${requestedPath}`;

    // First, try to serve static file from disk
    try {
      // console.log("vibesDiyHandler req.url:", req.url);
      for (const testDir of ["", "public"]) {
        let testPath = localPath;
        if (testDir) {
          testPath = `./${testDir}/${requestedPath}`;
        }
        const content = await ctx().then((ctx) => ctx.loadFileBinary(testPath));
        if (content) {
          const ext = requestedPath.substring(requestedPath.lastIndexOf("."));
          const mimeType = mime.getType(ext) || "application/octet-stream";
          console.log(
            "Serving static file:",
            testPath,
            "with ext:",
            ext,
            "mimeType:",
            mimeType,
          );

          return new Response(uint8array2stream(content), respInit(200, mimeType));
        }
      }
    } catch (_error) {
      // File not found, continue to TSX rendering
    }

    // If no static file found, render index.tsx
    try {
      const indexPath = `./index.tsx`;
      const html = await loadAndRenderTSX(indexPath, await ctx());
      console.log("vibesDiyHandler-done req.url:", req.url);
      return new Response(html, respInit(200, "text/html"));
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), respInit(500));
    }
  };
}
