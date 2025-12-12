import { loadAndRenderTSX, loadAndRenderJSX, VibesDiyServCtx } from "./render.js";
import { contentType } from "mime-types";
import { getClerkKeyForHostname } from "../clerk-env.js";

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
  }
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



export function vibesDiyHandler(ctx: () => Promise<VibesDiyServCtx>): (req: Request) => Promise<Response|null> {
  return async (req: Request) => {
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
          }
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
        }
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
          }
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

    // Handle /vibe/{appSlug}/{groupId} routes (both required)
    const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)\/([^/]+)/);
    if (vibeMatch) {
      const vibeResponse = handleVibeRequest(
        req,
        {
            appSlug: vibeMatch[1],
            groupId: vibeMatch[2],
            ...(await ctx()),
        }
      );
      return vibeResponse;
    }

    // Map request path to local filesystem
    // const cwd = Deno.cwd();
    const localPath = `./${requestedPath}`;

    // First, try to serve static file from disk
    try {
      const content = await ctx().then(ctx => ctx.loadFile(localPath))
      if (content) {
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
      const indexPath = `./index.tsx`;
      const html = await loadAndRenderTSX(indexPath, await ctx());

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
  };
}
