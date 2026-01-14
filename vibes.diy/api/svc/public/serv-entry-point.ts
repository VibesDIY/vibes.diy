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
import { DefaultHttpHeaders } from "../create-handler.ts";
import {
  extractFsIdAndGroupIdFromHost,
  FsIdAndGroupId,
} from "../entry-point-utils.ts";
import { VibesApiSQLCtx } from "../api.ts";
import { sqlApps, sqlAssets } from "../sql/assets-fs.ts";
import { eq } from "drizzle-orm";
import { FileSystemItem, fileSystemItem, ResponseType } from "../types.ts";
import { type } from "arktype";

function pairReqRes(
  key: CoerceURI,
  content: unknown,
  item: FileSystemItem,
): [Request, Response] {
  return [
    new Request(URI.from(key).toString()),
    // cast is stupid here
    new Response(content as string, {
      headers: {
        "Content-Type": item.mimeType,
        "X-Vibes-Asset-Id": item.assetId,
      },
    }),
  ];
}

export async function fetchContent(
  ctx: HandleTriggerCtx<Request, FsIdAndGroupId, unknown>,
  item: FileSystemItem,
): Promise<Result<Uint8Array>> {
  const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  const assetCacheCidUrl = BuildURI.from(vctx.params.assetCacheUrl)
    .appendRelative(item.assetId)
    .toString();
  const matched = await Promise.all([
    vctx.cache.match(new Request(assetCacheCidUrl)),
    vctx.cache.match(
      new Request(
        BuildURI.from(ctx.validated.url)
          .appendRelative(item.fileName)
          .toString(),
      ),
    ),
  ]);
  if (matched[0] || matched[1]) {
    if (matched[0]) {
      const clone = matched[0].clone();
      const arrayBuffer = await clone.arrayBuffer();
      if (!matched[1]) {
        vctx.waitUntil(
          vctx.cache.put(
            ...pairReqRes(
              BuildURI.from(ctx.validated.url)
                .appendRelative(item.fileName)
                .toString(),
              arrayBuffer,
              item,
            ),
          ),
        );
      }
      return Result.Ok(new Uint8Array(arrayBuffer));
    }
    if (matched[1]) {
      const clone = matched[1].clone();
      const arrayBuffer = await clone.arrayBuffer();
      if (!matched[0]) {
        vctx.waitUntil(
          vctx.cache.put(...pairReqRes(assetCacheCidUrl, arrayBuffer, item)),
        );
      }
      return Result.Ok(new Uint8Array(arrayBuffer));
    }
  }
  const assetURI = URI.from(item.assetURI);
  switch (assetURI.protocol) {
    case "sql":
      {
        const asset = await vctx.db
          .select()
          .from(sqlAssets)
          .where(eq(sqlAssets.assetId, item.assetId))
          .get();
        if (!asset) {
          return Result.Err(new Error(`Asset not found: ${item.assetId}`));
        }
        // inject into cache for assert lookups
        vctx.waitUntil(
          Promise.all([
            vctx.cache.put(
              ...pairReqRes(
                BuildURI.from(ctx.validated.url)
                  .appendRelative(item.fileName)
                  .toString(),
                asset.content,
                item,
              ),
            ),
            vctx.cache.put(
              ...pairReqRes(assetCacheCidUrl, asset.content, item),
            ),
          ]),
        );
        return Result.Ok(asset.content as Uint8Array);
      }
      break;
    default:
      return Result.Err(
        new Error(`Unsupported assetURI protocol: ${assetURI.protocol}`),
      );
  }
}

export const servEntryPoint: EventoHandler<Request, FsIdAndGroupId, unknown> = {
  hash: "serv-entry-point",
  validate: (ctx: ValidateTriggerCtx<Request, FsIdAndGroupId, unknown>) => {
    const { request: req } = ctx;
    const matchHost = extractFsIdAndGroupIdFromHost({
      matchURL: req?.url ?? "",
      urlTemplate:
        ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").params
          .entryPointTemplateUrl,
    });
    if (req && req.method === "GET" && matchHost.IsSome()) {
      return Promise.resolve(Result.Ok(Option.Some(matchHost.unwrap())));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<Request, FsIdAndGroupId, unknown>,
  ): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const fs = await vctx.db
      .select()
      .from(sqlApps)
      .where(eq(sqlApps.fsId, ctx.validated.fsId))
      .get();
    if (!fs) {
      // todo render 404 page
      await ctx.send.send(ctx, {
        type: "Response",
        payload: {
          status: 404,
          headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            type: "error",
            message: `Filesystem not found ${ctx.validated.fsId}`,
          }),
        },
      } satisfies ResponseType);
      return Result.Ok(EventoResult.Stop);
    }
    const fileSystems = type([fileSystemItem, "[]"])(fs.fileSystem);
    if (fileSystems instanceof type.errors) {
      // todo render 500 page
      await ctx.send.send(ctx, {
        type: "Response",
        payload: {
          status: 500,
          headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            type: "error",
            message: `Invalid filesystem data ${ctx.validated.fsId}`,
          }),
        },
      } satisfies ResponseType);
      return Result.Ok(EventoResult.Stop);
    }
    // const calculated: FileSystemItem[] = []

    // const hasImportMap = fileSystems.some(fsi => fsi.mimeType === "application/importmap+json");

    //   }
    //   return Result.Ok({
    //     ...item,
    //     content: rContent.unwrap(),
    //     transformed: res
    //   });
    // });

    // // transform Files -> { transformed, dependencies }[]

    await ctx.send.send(ctx, {
      type: "Response",
      payload: {
        status: 200,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type: "ok", message: "CORS preflight" }),
      },
    } satisfies ResponseType);
    return Result.Ok(EventoResult.Stop);
  },
};
