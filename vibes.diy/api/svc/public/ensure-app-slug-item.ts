import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqEnsureAppSlug,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase as unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx, StorageResult } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";
import { calcCid } from "../intern/ensure-storage.js";
import { collectSuccessfulAssetPutRows } from "../intern/asset-provider.js";

// ReqWithVerifiedAuth<ReqEnsureAppSlug>
export async function ensureAppSlugItem(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>
): Promise<Result<ResEnsureAppSlug>> {
  // console.log("handle ensureAppSlugItem", ctx.validated);
  const rAppSlugBinding = await ensureSlugBinding(vctx, {
    userId: req.auth.verifiedAuth.claims.userId,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
  });
  if (rAppSlugBinding.isErr()) {
    return Result.Err(rAppSlugBinding);
  }
  const writeAppSlugsOp: {
    fsItem: VibeFile;
    assetOp: {
      cid: string;
      data: Uint8Array;
    };
    size: number;
  }[] = [];
  for (const fsItem of req.fileSystem) {
    switch (fsItem.type) {
      case "code-block":
      case "str-asset-block":
      case "uint8-asset-block":
        {
          const assetOp = await calcCid(vctx, fsItem.content);
          writeAppSlugsOp.push({
            fsItem,
            assetOp,
            size: assetOp.data.byteLength,
          });
        }
        break;
      case "uint8-asset-ref":
      case "code-ref":
      case "str-asset-ref":
      default:
        // needs to rewind content from ref
        return Result.Err(new Error(`unsupported file system item type: ${fsItem.type}`));
    }
  }
  const rPutResults = await vctx.assetProvider.puts(writeAppSlugsOp.map((op) => op.assetOp));
  if (rPutResults.isErr()) {
    return Result.Err(rPutResults.Err());
  }
  const putResults = rPutResults.Ok();
  const rRows = collectSuccessfulAssetPutRows(writeAppSlugsOp, putResults, (op) => op.assetOp.cid);
  if (rRows.isErr()) {
    return Result.Err(rRows.Err());
  }
  const rows = rRows.Ok();

  const now = new Date();
  const fullFileSystem: { vibeFileItem: VibeFile; storage: StorageResult }[] = rows.map(({ input: op, result }) => ({
    vibeFileItem: op.fsItem,
    storage: {
      cid: op.assetOp.cid,
      getURL: result.value.url,
      mode: "created" as const,
      created: now,
      size: op.size,
    },
  }));
  const res = await ensureApps(vctx, req, rAppSlugBinding.Ok(), fullFileSystem);
  if (res.isErr()) {
    return Result.Err(res);
  }
  const wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().userSlug}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  const entryPointUrl = calcEntryPointUrl({
    ...vctx.params.vibes.svc,
    bindings: {
      userSlug: res.Ok().userSlug,
      appSlug: res.Ok().appSlug,
      fsId: res.Ok().fsId,
    },
  });
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: rAppSlugBinding.Ok().appSlug,
    userSlug: rAppSlugBinding.Ok().userSlug,
    // promptId: req.promptId,
    // chatId: req.chatId,
    mode: req.mode,
    fsId: res.Ok().fsId,
    env: req.env ?? {},
    fileSystem: res.Ok().fileSystem,
    wrapperUrl,
    entryPointUrl,
  });
}

export const ensureAppSlugItemEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureAppSlug>,
  ResEnsureAppSlug | VibesDiyError
> = {
  hash: "ensure-appSlug-item",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // async (ctx): Promise<Result<Option<ReqEnsureAppSlug>>> => {
    const ret = reqEnsureAppSlug(msg.payload);
    // console.log("validate ensureAppSlugItem", payload, ret);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqEnsureAppSlug>>, ResEnsureAppSlug | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      // console.log("handle ensureAppSlugItem", ctx.validated);
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rAppSlugBinding = await ensureAppSlugItem(vctx, req);
      if (rAppSlugBinding.isErr()) {
        return Result.Err(rAppSlugBinding);
      }

      // console.log("ensureAppSlugItem res", res.Ok());
      await ctx.send.send(ctx, rAppSlugBinding.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
