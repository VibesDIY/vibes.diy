import {
  EventoHandler,
  EventoResult,
  EventoResultType,
  HandleTriggerCtx,
  Result,
  ValidateTriggerCtx,
  Option,
  BuildURI,
  URI,
  CoerceURI,
} from "@adviser/cement";
import { ExtractedHostToBindings, extractHostToBindings } from "../entry-point-utils.js";
import { VibesApiSQLCtx } from "../types.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { eq, and, desc } from "drizzle-orm";
import { FileSystemItem, fileSystemItem, HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
import { type } from "arktype";
import { isReadableStreamContent, renderVibes } from "../intern/render-vibes.js";
import { parse } from "cookie";

function pairReqRes(key: CoerceURI, content: BodyInit, item: FileSystemItem, headers: HeadersInit): [Request, Response] {
  return [new Request(URI.from(key).toString()), new Response(content as BodyInit, { headers })];
}

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

export async function fetchContent(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  item: FileSystemItem,
  iheaders?: HeadersInit
): Promise<Result<Option<Uint8Array | ReadableStream<Uint8Array>>>> {
  const headers: HeadersInit = {
    ...iheaders,
    "X-Vibes-Asset-Id": item.assetId,
    ETag: item.assetId,
    "Cache-Control": "no-cache",
    "content-type": item.mimeType,
  };
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const assetCacheCidUrl = BuildURI.from(vctx.params.assetCacheUrl).appendRelative(item.assetId).toString();
  const matched = await Promise.all([
    vctx.cache.match(new Request(assetCacheCidUrl)),
    vctx.cache.match(new Request(BuildURI.from(ctx.validated.url).appendRelative(item.fileName).toString())),
  ]);
  if (matched[0] || matched[1]) {
    if (matched[0]) {
      const clone = matched[0].clone();
      const arrayBuffer = await clone.arrayBuffer();
      if (!matched[1]) {
        await vctx.cache.put(
          ...pairReqRes(BuildURI.from(ctx.validated.url).appendRelative(item.fileName).toString(), arrayBuffer, item, headers)
        );
      }
      return Result.Ok(Option.Some(new Uint8Array(arrayBuffer)));
    }
    if (matched[1]) {
      const clone = matched[1].clone();
      const arrayBuffer = await clone.arrayBuffer();
      if (!matched[0]) {
        await vctx.cache.put(...pairReqRes(assetCacheCidUrl, arrayBuffer, item, headers));
      }
      return Result.Ok(Option.Some(new Uint8Array(arrayBuffer)));
    }
  }
  const rGetResults = await vctx.assetProvider.gets([item.assetURI]);
  if (rGetResults.isErr()) {
    return Result.Err(rGetResults.Err());
  }
  const getResult = rGetResults.Ok()[0];
  if (!getResult || getResult.isErr()) {
    return Result.Err(getResult?.Err() ?? new Error(`Missing asset provider result for ${item.assetURI}`));
  }
  const maybeStream = getResult.Ok();
  if (maybeStream.IsNone()) {
    return Result.Ok(Option.None());
  }

  const content = maybeStream.unwrap();
  if (isReadableStreamContent(content)) {
    return Result.Ok(Option.Some(content));
  }

  await Promise.all([
    vctx.cache.put(
      ...pairReqRes(BuildURI.from(ctx.validated.url).appendRelative(item.fileName).toString(), content, item, headers)
    ),
    vctx.cache.put(...pairReqRes(assetCacheCidUrl, content, item, headers)),
  ]);
  return Result.Ok(Option.Some(content));
}

async function renderFromFs(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  pred: () => FileSystemItem | undefined
): Promise<Result<EventoResultType>> {
  const foundPath = pred();
  if (foundPath) {
    const rContent = await fetchContent(ctx, foundPath);
    if (rContent.isErr()) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 500,
        json: {
          type: "error",
          message: `Error fetching content for ${ctx.validated.path}: ${rContent.Err().message}`,
        },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }
    const maybeContent = rContent.Ok();
    if (maybeContent.IsNone()) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 404,
        json: {
          type: "error",
          message: `Asset not found for ${ctx.validated.path}`,
        },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }
    const content = maybeContent.unwrap();
    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      headers: {
        "Content-Type": foundPath.mimeType,
        "X-Vibes-Asset-Id": foundPath.assetId,
        ETag: foundPath.assetId,
        "Cache-Control": "no-cache",
      },
      body: content,
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  }
  return Result.Ok(EventoResult.Continue);
}

export const servEntryPoint: EventoHandler<Request, ExtractedHostToBindings, unknown> = {
  hash: "serv-entry-point",
  validate: (ctx: ValidateTriggerCtx<Request, ExtractedHostToBindings, unknown>) => {
    const { request: req } = ctx;
    if (req && req.method === "GET") {
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
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    console.log("servEntryPoint triggered with URL:", ctx.validated.url);
    let fs: typeof sqlApps.$inferSelect | undefined = undefined;
    if (ctx.validated.fsId) {
      fs = await vctx.db
        .select()
        .from(sqlApps)
        .where(
          and(
            eq(sqlApps.userSlug, ctx.validated.userSlug),
            eq(sqlApps.appSlug, ctx.validated.appSlug),
            eq(sqlApps.fsId, ctx.validated.fsId)
          )
        )
        .get();
    } else {
      fs = await vctx.db
        .select()
        .from(sqlApps)
        .where(
          and(
            eq(sqlApps.userSlug, ctx.validated.userSlug),
            eq(sqlApps.appSlug, ctx.validated.appSlug),
            eq(sqlApps.mode, "production")
          )
        )
        .orderBy(desc(sqlApps.releaseSeq))
        .limit(1)
        .get();
      // inject fsId into validated for further use
      ctx.validated.fsId = fs?.fsId;
    }
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
    const fileSystem = type([fileSystemItem, "[]"])(fs.fileSystem);
    if (fileSystem instanceof type.errors) {
      return Result.Err(`Invalid filesystem data ${ctx.validated.fsId}`);
    }

    const possiblePath = await renderFromFs(ctx, () => fileSystem.find((i) => i.fileName === ctx.validated.path));
    if (possiblePath.isErr()) {
      return possiblePath;
    }
    if (possiblePath.unwrap() === EventoResult.Stop) {
      return Result.Ok(EventoResult.Stop);
    }
    const entryPointPath = await renderFromFs(ctx, () => fileSystem.find((i) => i.entryPoint));
    if (entryPointPath.isErr()) {
      return entryPointPath;
    }
    if (entryPointPath.unwrap() === EventoResult.Stop) {
      return Result.Ok(EventoResult.Stop);
    }
    if (ctx.validated.path === "/" || ctx.validated.path === "/index.html") {
      const npmUrl = captureNpmUrl(vctx, ctx.request);
      const rVibesEntryPoint = await renderVibes({
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
