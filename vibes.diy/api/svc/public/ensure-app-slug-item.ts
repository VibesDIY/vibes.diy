import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  EvtNewFsId,
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
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";

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
      data: string | Uint8Array;
    };
  }[] = [];
  for (const fsItem of req.fileSystem) {
    switch (fsItem.type) {
      case "code-block":
      case "str-asset-block":
      case "uint8-asset-block":
        {
          writeAppSlugsOp.push({
            fsItem,
            assetOp: { data: fsItem.content },
          });
        }
        break;
      case "uint8-asset-ref":
      case "code-ref":
      case "str-asset-ref":
      default:
        // needs to rewind content from ref
        return Result.Err(`unsupported file system item type: ${fsItem.type}`);
    }
  }
  const rStorageResults = await vctx.storage.ensure(
    ...writeAppSlugsOp.map(
      (op) =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(op.assetOp.data);
            controller.close();
          },
        })
    )
  );
  if (rStorageResults.some((r) => r.isErr())) {
    return Result.Err(`failed to store one or more assets: ${rStorageResults.map((r) => (r.isErr() ? r.Err().message : "ok")).join(", ")}`);
  }
  const fullFileSystem = rStorageResults.map((op, idx) => ({
    vibeFileItem: writeAppSlugsOp[idx].fsItem,
    storage: op.Ok(),
  }));
  const res = await ensureApps(vctx, req, rAppSlugBinding.Ok(), fullFileSystem);
  if (res.isErr()) {
    return Result.Err(res);
  }
  // let wrapperUrl: string;
  // if (req.mode === "production") {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().userSlug}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // } else {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().userSlug}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // }
  const entryPointUrl = calcEntryPointUrl({
    ...vctx.params.vibes.svc,
    bindings: {
      userSlug: res.Ok().userSlug,
      appSlug: res.Ok().appSlug,
      fsId: res.Ok().fsId,
    },
  });
  if (res.Ok().fsId) {
    vctx.postQueue({
      payload: {
        type: "vibes.diy.evt-new-fs-id",
        userSlug: res.Ok().userSlug,
        appSlug: res.Ok().appSlug,
        fsId: res.Ok().fsId,
        vibeUrl: entryPointUrl,
        sessionToken: "offline",
      },
      tid: "queue-event",
      src: "ensureAppSlugItem",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtNewFsId>);
  }
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
    // wrapperUrl,
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
