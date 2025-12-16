import {
  loadAndRenderTSX,
  VibesDiyServCtx,
  buildMountedApp,
} from "./render.js";
// import { contentType } from "mime-types";
import mime from "mime";
import { LRUMap, uint8array2stream } from "@adviser/cement";

function respInit(
  status: number,
  contentType = "application/json",
): ResponseInit {
  return {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Content-Type": contentType,
    },
  };
}

async function fetchVibeCode(
  req: Request,
  appSlug: string,
): Promise<{
  origin: "POST" | "FETCH";
  code: string;
}> {
  if (req.method === "POST") {
    const body = (await req.json()) as { code?: string };
    if (!body.code) {
      throw new Error("Missing code in request body");
    }
    return { origin: "POST", code: body.code };
  }
  // Fetch vibe code from hosting subdomain App.jsx endpoint
  const response = await fetch(`https://${appSlug}.vibesdiy.app/App.jsx`);
  if (!response.ok) {
    throw new Error(`Failed to fetch vibe: ${response.statusText}`);
  }
  return { origin: "FETCH", code: await response.text() };
}

const sessionVibes = new LRUMap<string, string>({
  maxEntries: 100,
  maxAge: 1000 * 60 * 10,
});

async function handleVibeRequest(
  req: Request,
  ctx: VibesDiyServCtx,
): Promise<Response | null> {
  try {
    const key = `${ctx.vibesCtx.appSlug}-${ctx.vibesCtx.groupId}`;
    if (req.method !== "POST" && sessionVibes.has(key)) {
      const cachedHTML = sessionVibes.get(key);
      console.log("Serving cached vibe for key:", key);
      return new Response(cachedHTML, respInit(200, "text/html"));
    }
    console.log("handleVibeRequest for appSlug:", ctx.vibesCtx);
    const vibeCode = await fetchVibeCode(req, ctx.vibesCtx.appSlug);

    // Transform JSX → JS (externalized imports)
    const transformedJS = await buildMountedApp(ctx.vibesCtx, vibeCode.code);
    // Render vibe.tsx template with transformed JS
    const vibePath = `./vibe.tsx`;
    const html = await loadAndRenderTSX(vibePath, {
      ...ctx,
      isSession: vibeCode.origin === "POST",
      transformedJS,
    });
    sessionVibes.set(key, html);
    return new Response(html, respInit(200, "text/html"));
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      respInit(500, "application/json"),
    );
  }
}

export function vibesDiyHandler(
  ctx: () => Promise<VibesDiyServCtx>,
): (req: Request) => Promise<Response | null> {
  return async (req: Request) => {
    const url = new URL(req.url);
    const requestedPath = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, respInit(204));
    }

    // if (url.pathname === "/vibe-mount") {
    //   const appSlug = url.searchParams.get("appSlug");
    //   if (!appSlug) {
    //     return new Response(
    //       JSON.stringify({ error: "Missing appSlug parameter" }),
    //       respInit(400)
    //     );
    //   }
    //   const env = await ctx().then((c) => c.vibesCtx.env);

    //   const ctxStr = JSON.stringify({ appSlug, env });
    //   return new Response(
    //     `import { mountVibe } from '/dist/vibes.diy/pkg/serve/mount-vibe.js';
    //      import vibe from '/vibe-script?appSlug=${appSlug}';
    //      mountVibe(vibe, ${ctxStr});
    //     `,
    //     respInit(200, "text/javascript")
    //   );
    // }
    // if (url.pathname === "/vibe-script") {
    //   const appSlug = url.searchParams.get("appSlug");
    //   if (!appSlug) {
    //     return new Response(
    //       JSON.stringify({ error: "Missing appSlug parameter" }),
    //       respInit(400)
    //     );
    //   }
    //   const vibeCode = await fetchVibeCode(req, appSlug);
    //   const transformedJS = await loadAndRenderJSX(vibeCode);
    //   return new Response(transformedJS, respInit(200, "text/javascript"));
    // }

    // Handle /vibe/{appSlug}/{groupId} routes (both required)
    const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)\/([^/]+)/);
    if (vibeMatch) {
      const vibeResponse = handleVibeRequest(req, {
        ...(await ctx()),
        vibesCtx: {
          ...(await ctx()).vibesCtx,
          appSlug: vibeMatch[1],
          titleId: vibeMatch[1],
          installId: vibeMatch[2],
          groupId: vibeMatch[2],
        },
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

          return new Response(
            uint8array2stream(content),
            respInit(200, mimeType),
          );
        }
      }
    } catch (_error) {
      // File not found, continue to TSX rendering
    }

    // If no static file found, render index.tsx
    try {
      const indexPath = `./index.tsx`;
      const vibeCtx = (await ctx()).vibesCtx;
      const transformedJS = await buildMountedApp(
        vibeCtx,
        "",
        () => `
          import { mountVibesDiyApp } from "./dist/vibes.diy/pkg/app/mount-vibes-diy-app.js";
          mountVibesDiyApp(${JSON.stringify(vibeCtx)});
        `,
      );
      console.log("TransformedJS:", transformedJS);

      const html = await loadAndRenderTSX(indexPath, {
        ...(await ctx()),
        isSession: false,
        transformedJS,
      });
      console.log("render req.url:", req.url);
      return new Response(html, respInit(200, "text/html"));
    } catch (error) {
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        respInit(500),
      );
    }
  };
}
