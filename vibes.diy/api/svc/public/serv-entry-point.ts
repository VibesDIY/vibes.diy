import {
  EventoHandler,
  EventoResult,
  EventoResultType,
  HandleTriggerCtx,
  Result,
  ValidateTriggerCtx,
  Option,
  URI,
} from "@adviser/cement";
import { ExtractedHostToBindings, extractHostToBindings } from "../entry-point-utils.js";
import { VibesApiSQLCtx } from "../types.js";
import { eq, and, desc } from "drizzle-orm/sql/expressions";
import {
  FetchResult,
  FileSystemItem,
  fileSystemItem,
  HttpResponseBodyType,
  HttpResponseJsonType,
  isFetchErrResult,
  isFetchOkResult,
  isMetaScreenShot,
  MetaItem,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { renderVibe } from "../intern/render-vibe.js";
import { parse } from "cookie";
import { renderToReadableStream } from "react-dom/server";
import { renderDBExplorer } from "../intern/render-db-explorer.js";

// function pairReqRes(key: CoerceURI, content: BodyInit, item: FileSystemItem, headers: HeadersInit): [Request, Response] {
//   return [new Request(URI.from(key).toString()), new Response(content as BodyInit, { headers })];
// }

export interface NpmUrlCapture {
  readonly npmURL: string;
  readonly fromCookie: boolean;
  readonly fromURL: boolean;
  readonly fromEnv: boolean;
  readonly fromDef: boolean;
}

export function captureNpmUrl(vctx: VibesApiSQLCtx, req: Request): NpmUrlCapture {
  const url = URI.from(req.url).getParam("npmUrl");
  if (url) {
    return { npmURL: url, fromCookie: false, fromURL: true, fromEnv: false, fromDef: false };
  }
  const cookies = parse(req.headers.get("Cookie") || "");
  if (cookies["Vibes-Npm-Url"]) {
    return { npmURL: cookies["Vibes-Npm-Url"], fromCookie: true, fromURL: false, fromEnv: false, fromDef: false };
  }
  return { npmURL: vctx.params.pkgRepos.workspace, fromCookie: false, fromURL: false, fromEnv: true, fromDef: false };
}

// async function renderFromFs(ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>): Promise<FetchResult> {
//   const foundPath = pred();
//   if (foundPath) {
//     const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
//     return vctx.storage.fetch(foundPath.assetURI);
//     // const headers: HeadersInit = {
//     //   "content-type": foundPath.mimeType,
//     //   "content-length": foundPath.size.toString(),
//     // };
//   }
//   return {
//     type: "fetch.notfound",
//     url: "none://",
//   };

//   //   switch (true) {
//   //     case isFetchErrResult(rContent):
//   //       await ctx.send.send(ctx, {
//   //         type: "http.Response.JSON",
//   //         status: 500,
//   //         headers: {
//   //           ...headers,
//   //           "Cache-Control": "public, max-age=60",
//   //         },
//   //         json: {
//   //           type: "error",
//   //           message: `Error fetching content for ${ctx.validated.path}: ${rContent.error.message}`,
//   //         },
//   //       } satisfies HttpResponseJsonType);
//   //       break;

//   //     case isFetchNotFoundResult(rContent):
//   //       await ctx.send.send(ctx, {
//   //         type: "http.Response.JSON",
//   //         status: 404,
//   //         headers: {
//   //           ...headers,
//   //           "Cache-Control": "public, max-age=86400",
//   //         },
//   //         json: {
//   //           type: "error",
//   //           message: `AssetNotFound not found for ${ctx.validated.path}`,
//   //         },
//   //       } satisfies HttpResponseJsonType);
//   //       break;

//   //     case isFetchOkResult(rContent):
//   //       await ctx.send.send(ctx, {
//   //         type: "http.Response.Body",
//   //         status: 200,
//   //         headers: {
//   //           ...headers,
//   //           "Cache-Control": "public, max-age=31536000, immutable",
//   //           ETag: foundPath.assetId,
//   //         },
//   //         body: rContent.data,
//   //       } satisfies HttpResponseBodyType);
//   //       break;
//   //     default:
//   //       throw new Error(`Unexpected fetch result type for ${ctx.validated.path}`);
//   //   }
//   // } else {
//   //   await ctx.send.send(ctx, {
//   //     type: "http.Response.JSON",
//   //     status: 404,
//   //     headers: {
//   //       "Cache-Control": "public, max-age=86400",
//   //     },
//   //     json: {
//   //       type: "error",
//   //       message: `Content not found for ${ctx.validated.path}`,
//   //     },
//   //   } satisfies HttpResponseJsonType);
//   // }
//   // return Result.Ok(EventoResult.Continue);
// }

async function sendFetchOk(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  item: FileSystemItem,
  fRes: FetchResult
) {
  console.log(
    `Fetch ok for ${item.fileName} with MIME type ${item.mimeType} and size ${item.size}: fetch result type ${fRes.type}`
  );
  if (isFetchOkResult(fRes)) {
    console.log(`Fetch ok for ${item.fileName} with MIME type ${item.mimeType} and size ${item.size}`);
    const assetRes = new Response(fRes.data);
    const asset = await assetRes.arrayBuffer();
    console.log(
      `Fetch ok for ${item.fileName} with MIME type ${item.mimeType} and size ${item.size}, asset size: ${asset.byteLength}`
    );

    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      headers: {
        "Content-Type": item.mimeType,
        // "Content-Length": item.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: item.assetId,
      },
      body: asset,
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  }
  return Result.Ok(EventoResult.Continue);
}

export const servEntryPoint: EventoHandler<Request, ExtractedHostToBindings, unknown> = {
  hash: "serv-entry-point",
  validate: (ctx: ValidateTriggerCtx<Request, ExtractedHostToBindings, unknown>) => {
    const { request: req } = ctx;
    if (req && (req.method === "GET" || req.method === "HEAD")) {
      const matchHost = extractHostToBindings({
        matchURL: req?.url ?? "",
      });
      if (matchHost.IsSome()) {
        return Promise.resolve(Result.Ok(Option.Some(matchHost.unwrap())));
      }
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>): Promise<Result<EventoResultType>> => {
    const uri = URI.from(ctx.request.url);
    if (uri.pathname.startsWith("/.db-explorer")) {
      // console.log('xxxxxxx', DBExplorer.toString())
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const npmUrl = captureNpmUrl(vctx, ctx.request);
      await ctx.send.send(ctx, {
        type: "http.Response.Body",
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "public, max-age=86400",
        },
        body:
          ctx.request.method === "HEAD"
            ? ""
            : ((await renderToReadableStream(
                await renderDBExplorer({
                  base: "/.db-explorer",
                  vctx,
                  pkgRepos: {
                    private: npmUrl,
                  },
                })
              )) as BodyInit),
      });
      return Result.Ok(EventoResult.Continue);
    }

    // console.log("-1servEntryPoint triggered with URL:", uri.toString())
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    // console.log("-2servEntryPoint triggered with URL:", uri.toString())
    let fs: typeof vctx.sql.tables.apps.$inferSelect | undefined;
    if (ctx.validated.fsId) {
      fs = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.apps)
        .where(
          and(
            eq(vctx.sql.tables.apps.userSlug, ctx.validated.userSlug),
            eq(vctx.sql.tables.apps.appSlug, ctx.validated.appSlug),
            eq(vctx.sql.tables.apps.fsId, ctx.validated.fsId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
    } else {
      fs = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.apps)
        .where(
          and(
            eq(vctx.sql.tables.apps.userSlug, ctx.validated.userSlug),
            eq(vctx.sql.tables.apps.appSlug, ctx.validated.appSlug),
            eq(vctx.sql.tables.apps.mode, "production")
          )
        )
        .orderBy(desc(vctx.sql.tables.apps.releaseSeq))
        .limit(1)
        .then((r) => r[0]);
      // inject fsId into validated for further use
      ctx.validated.fsId = fs?.fsId;
    }
    // console.log("-3servEntryPoint triggered with URL:", uri.toString())
    if (!fs) {
      // todo render 404 page
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 404,
        json: {
          type: "error",
          message: `Filesystem not found ${JSON.stringify(ctx.validated)}`,
        },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }
    // console.log("-4servEntryPoint triggered with URL:", uri.toString())
    const fileSystem = type([fileSystemItem, "[]"])(fs.fileSystem);
    if (fileSystem instanceof type.errors) {
      return Result.Err(`Invalid filesystem data ${ctx.validated.fsId}`);
    }

    // console.log("-5servEntryPoint triggered with URL:", uri.toString())
    // console.log('fsId =>', fileSystem)

    const selectedFsItem = fileSystem.find((i) => i.fileName === ctx.validated.path);
    if (selectedFsItem) {
      const possiblePath = await vctx.storage.fetch(selectedFsItem.assetURI);
      if (isFetchErrResult(possiblePath)) {
        return Result.Err(possiblePath.error);
      }
      if (isFetchOkResult(possiblePath)) {
        return sendFetchOk(ctx, selectedFsItem, possiblePath);
      }
    }
    // Serve screenshot from meta for social media cards
    if (ctx.validated.path === "/screenshot.png" || ctx.validated.path === "/screenshot.jpg") {
      const metaItems = (fs.meta as MetaItem[]) || [];
      const shot = metaItems.find(isMetaScreenShot);
      if (shot) {
        const shotFetch = await vctx.storage.fetch(shot.assetUrl);
        if (isFetchOkResult(shotFetch)) {
          const assetRes = new Response(shotFetch.data);
          const asset = await assetRes.arrayBuffer();
          await ctx.send.send(ctx, {
            type: "http.Response.Body",
            status: 200,
            headers: {
              "Content-Type": shot.mime,
              "Cache-Control": "public, max-age=86400",
            },
            body: asset,
          } satisfies HttpResponseBodyType);
          return Result.Ok(EventoResult.Stop);
        }
      }
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 404,
        json: { type: "error", message: "No screenshot available" },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    // console.log("-6servEntryPoint triggered with URL:", uri.toString())
    const selectedEntryPoint = fileSystem.find((i) => i.entryPoint);
    if (selectedEntryPoint) {
      const entryPointPath = await vctx.storage.fetch(selectedEntryPoint.assetURI);
      if (isFetchErrResult(entryPointPath)) {
        return Result.Err(entryPointPath.error);
      }
      if (isFetchOkResult(entryPointPath)) {
        return sendFetchOk(ctx, selectedEntryPoint, entryPointPath);
      }
    }
    // console.log("-7servEntryPoint triggered with URL:", uri.toString())
    if (ctx.validated.path === "/" || ctx.validated.path === "/index.html") {
      const npmUrl = captureNpmUrl(vctx, ctx.request);
      const rVibesEntryPoint = await renderVibe({
        ctx,
        fs,
        fsItems: fileSystem,
        pkgRepos: {
          private: npmUrl,
        },
      });
      // console.log("3-servEntryPoint triggered with URL:", ctx.validated.url, rVibesEntryPoint);
      if (rVibesEntryPoint.isErr()) {
        return rVibesEntryPoint;
      }
      return Result.Ok(EventoResult.Stop);
    }
    // todo render 404 page
    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 404,
      json: {
        type: "error",
        message: `File not found ${ctx.validated.path}`,
      },
    } satisfies HttpResponseJsonType);
    return Result.Ok(EventoResult.Stop);
  },
};
