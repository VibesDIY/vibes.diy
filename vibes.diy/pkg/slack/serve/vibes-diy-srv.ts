import { loadAndRenderTSX, VibesDiyServCtx, buildMountedApp } from "./render.js";
// import { contentType } from "mime-types";
import mime from "mime";
import { exception2Result, LRUMap, Result, uint8array2stream } from "@adviser/cement";
import { type } from "arktype";

function respInit(status: number, contentType = "application/json"): ResponseInit {
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

interface VibeCode {
  readonly origin: "POST" | "FETCH";
  readonly code: string;
}

const postBody = type({ code: "string" });

export async function fetchVibeCode(req: Request, appSlug: string): Promise<Result<VibeCode>> {
  if (req.method === "POST") {
    const rawBody = await exception2Result(() => req.json());
    if (rawBody.isErr()) {
      return Result.Err("Invalid JSON body");
    }
    const body = postBody(rawBody.Ok());
    if (body instanceof type.errors) {
      return Result.Err(body.summary);
    }
    return Result.Ok({ origin: "POST", code: body.code });
  }
  // Fetch vibe code from hosting subdomain App.jsx endpoint
  const fetchResult = await exception2Result(() => fetch(`https://${appSlug}.vibesdiy.app/App.jsx`));
  if (fetchResult.isErr()) {
    return Result.Err(`Failed to fetch vibe: ${fetchResult.Err().message}`);
  }
  const response = fetchResult.Ok();
  if (!response.ok) {
    return Result.Err(`Failed to fetch vibe: ${response.statusText}`);
  }
  const textResult = await exception2Result(() => response.text());
  if (textResult.isErr()) {
    return Result.Err(`Failed to read vibe response: ${textResult.Err().message}`);
  }
  return Result.Ok({ origin: "FETCH", code: textResult.Ok() });
}

const sessionVibes = new LRUMap<string, string>({
  maxEntries: 100,
  maxAge: 1000 * 60 * 10,
});

async function handleVibeRequest(req: Request, ctx: VibesDiyServCtx): Promise<Response | null> {
  const key = `${ctx.vibesCtx.appSlug}-${ctx.vibesCtx.groupId}`;
  if (req.method !== "POST" && sessionVibes.has(key)) {
    const cachedHTML = sessionVibes.get(key);
    console.log("Serving cached vibe for key:", key);
    return new Response(cachedHTML, respInit(200, "text/html"));
  }
  console.log("handleVibeRequest for appSlug:", ctx.vibesCtx);
  const vibeCodeResult = await fetchVibeCode(req, ctx.vibesCtx.appSlug);
  if (vibeCodeResult.isErr()) {
    const status = req.method === "POST" ? 400 : 502;
    return new Response(JSON.stringify({ error: vibeCodeResult.Err().message }), respInit(status, "application/json"));
  }
  const vibeCode = vibeCodeResult.Ok();

  const buildResult = await exception2Result(() => buildMountedApp(ctx.vibesCtx, vibeCode.code));
  if (buildResult.isErr()) {
    return new Response(JSON.stringify({ error: buildResult.Err().message }), respInit(500, "application/json"));
  }
  const renderResult = await exception2Result(() =>
    loadAndRenderTSX(`./vibe.tsx`, {
      ...ctx,
      isSession: vibeCode.origin === "POST",
      transformedJS: buildResult.Ok(),
    })
  );
  if (renderResult.isErr()) {
    return new Response(JSON.stringify({ error: renderResult.Err().message }), respInit(500, "application/json"));
  }
  const html = renderResult.Ok();
  sessionVibes.set(key, html);
  return new Response(html, respInit(200, "text/html"));
}

export function vibesDiyHandler(ctx: () => Promise<VibesDiyServCtx>): (req: Request) => Promise<Response | null> {
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
    const vibeMatch = requestedPath.match(/^\/vibe\/([^/]+)\/*([^/]*)/);
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
          console.log("Serving static file:", testPath, "with ext:", ext, "mimeType:", mimeType);

          return new Response(uint8array2stream(content), respInit(200, mimeType));
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
        `
      );
      const html = await loadAndRenderTSX(indexPath, {
        ...(await ctx()),
        isSession: false,
        transformedJS,
      });
      console.log("render req.url:", req.url);
      return new Response(html, respInit(200, "text/html"));
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), respInit(500));
    }
  };
}
