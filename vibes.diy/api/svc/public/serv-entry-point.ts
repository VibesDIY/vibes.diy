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
import { VibesApiSQLCtx } from "../api.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { eq, and, desc } from "drizzle-orm";
import { FileSystemItem, fileSystemItem, HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
import { type } from "arktype";
import { renderVibes } from "../intern/render-vibes.js";
import { AssetNotFoundError } from "../intern/asset-provider.js";

function pairReqRes(key: CoerceURI, content: BodyInit, item: FileSystemItem, headers: HeadersInit): [Request, Response] {
  return [new Request(URI.from(key).toString()), new Response(content as BodyInit, { headers })];
}

export async function fetchContent(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  item: FileSystemItem,
  iheaders?: HeadersInit
): Promise<Result<Uint8Array>> {
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
      return Result.Ok(new Uint8Array(arrayBuffer));
    }
    if (matched[1]) {
      const clone = matched[1].clone();
      const arrayBuffer = await clone.arrayBuffer();
      if (!matched[0]) {
        await vctx.cache.put(...pairReqRes(assetCacheCidUrl, arrayBuffer, item, headers));
      }
      return Result.Ok(new Uint8Array(arrayBuffer));
    }
  }
  const getResults = await vctx.assetProvider.gets([item.assetURI]);
  const getResult = getResults[0];
  if (!getResult) {
    return Result.Err(new Error(`Missing asset provider result for ${item.assetURI}`));
  }
  if (!getResult.ok) {
    if (getResult.notFound) {
      return Result.Err(new AssetNotFoundError(getResult.url));
    }
    return Result.Err(getResult.error);
  }
  const content = getResult.value.data;
  await Promise.all([
    vctx.cache.put(
      ...pairReqRes(BuildURI.from(ctx.validated.url).appendRelative(item.fileName).toString(), content, item, headers)
    ),
    vctx.cache.put(...pairReqRes(assetCacheCidUrl, content, item, headers)),
  ]);
  return Result.Ok(content);
}

async function renderFromFs(
  ctx: HandleTriggerCtx<Request, ExtractedHostToBindings, unknown>,
  pred: () => FileSystemItem | undefined
): Promise<Result<EventoResultType>> {
  const foundPath = pred();
  if (foundPath) {
    const rContent = await fetchContent(ctx, foundPath);
    if (rContent.isErr()) {
      const err = rContent.Err();
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: err instanceof AssetNotFoundError ? 404 : 500,
        json: {
          type: "error",
          message: `Error fetching content for ${ctx.validated.path}: ${err.message}`,
        },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }
    const content = rContent.unwrap();
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
      const rVibesEntryPoint = await renderVibes(ctx, fs, fileSystem);
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
