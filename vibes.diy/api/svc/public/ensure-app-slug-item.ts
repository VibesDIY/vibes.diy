import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  uint8array2stream,
  to_uint8,
} from "@adviser/cement";
import {
  EvtNewFsId,
  isResEnsureAppSlugError,
  isResEnsureAppSlugOk,
  MsgBase,
  ReqEnsureAppSlug,
  ReqWithVerifiedAuth,
  ResEnsureAppSlug,
  ResEnsureAppSlugInvalid,
  ResProgress,
  StorageProgressInfo,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase as unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth as checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";

export interface EnsureAppSlugItemOptions {
  readonly onProgress?: (info: StorageProgressInfo) => void;
}

// ReqWithVerifiedAuth<ReqEnsureAppSlug>
export async function ensureAppSlugItem(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>,
  opts?: EnsureAppSlugItemOptions
): Promise<Result<ResEnsureAppSlug>> {
  // Reject if no code files provided — an app needs at least one .jsx/.js/.ts/.tsx
  const hasCodeFile = req.fileSystem.some((f) => f.type === "code-block");
  if (!hasCodeFile) {
    return Result.Ok({
      type: "vibes.diy.error",
      message: "No code files (.jsx, .js, .ts, .tsx) in fileSystem. An app requires at least one code file.",
      code: "app-slug-invalid",
    } satisfies ResEnsureAppSlugInvalid);
  }

  const rAppSlugBinding = await ensureSlugBinding(vctx, {
    claims: req._auth.verifiedAuth.claims,
    userId: req._auth.verifiedAuth.claims.userId,
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
    // console.log(`ensureAppSlugItem fsItem:`, fsItem);
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
    { onProgress: opts?.onProgress },
    ...writeAppSlugsOp.map((op) => uint8array2stream(to_uint8(op.assetOp.data)))
  );
  if (rStorageResults.some((r) => r.isErr())) {
    return Result.Err(
      `failed to store one or more assets: ${rStorageResults.map((r) => (r.isErr() ? r.Err().message : "ok")).join(", ")}`
    );
  }
  const fullFileSystem = rStorageResults.map((op, idx) => ({
    vibeFileItem: writeAppSlugsOp[idx].fsItem,
    storage: op.Ok(),
  }));

  const rEnsure = await ensureApps(vctx, req, rAppSlugBinding.Ok(), fullFileSystem);
  if (rEnsure.isErr()) {
    return Result.Err(rEnsure);
  }
  if (isResEnsureAppSlugError(rEnsure.Ok())) {
    return Result.Ok(rEnsure.Ok());
  }
  const ensured = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(ensured)) {
    return Result.Err(`Expected ensureApps to return ResEnsureAppSlugOk on success, got ${JSON.stringify(ensured)}`);
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
      userSlug: ensured.userSlug,
      appSlug: ensured.appSlug,
      fsId: ensured.fsId,
    },
  });
  if (ensured.fsId) {
    // console.log(`Posting evt-new-fs-id for fsId ${ensured.fsId}, entryPointUrl: ${entryPointUrl}`);
    await vctx.postQueue({
      payload: {
        type: "vibes.diy.evt-new-fs-id",
        userSlug: ensured.userSlug,
        appSlug: ensured.appSlug,
        fsId: ensured.fsId,
        vibeUrl: entryPointUrl,
        sessionToken: "offline",
        mode: req.mode,
      },
      tid: "queue-event",
      src: "ensureAppSlugItem",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtNewFsId>);
  }
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: ensured.appSlug,
    userSlug: ensured.userSlug,
    // userId: req._auth.verifiedAuth.claims.userId,
    // promptId: req.promptId,
    // chatId: req.chatId,
    mode: req.mode,
    fsId: ensured.fsId,
    env: req.env ?? {},
    fileSystem: ensured.fileSystem,
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
    const ret = ReqEnsureAppSlug(msg.payload);
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
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Emit a progress envelope back on the same connection per real
      // R2 part-complete/asset-stored signal. The client doesn't match this
      // to a `request()` waiter (no isResXxx hit), but receiving it resets
      // the idle timeout — keeping multi-MB pushes alive without a fixed
      // wall-clock bump.
      function emitProgress(info: StorageProgressInfo): void {
        const progress: ResProgress = {
          type: "vibes.diy.res-progress",
          stage: info.stage,
          ...(info.bytes === undefined ? {} : { bytes: info.bytes }),
          ...(info.partNumber === undefined ? {} : { partNumber: info.partNumber }),
        };
        // TODO(verify): drop this log once preview confirms emission flows.
        console.log("[progress-emit]", info.stage, "bytes=", info.bytes, "part=", info.partNumber);
        // Fire-and-forget: send returns a promise but we don't want to slow
        // the upload by awaiting it (and the caller is the storage layer).
        ctx.send.send(ctx, progress).catch((e: unknown) => {
          console.error("ensureAppSlugItem progress emit failed:", e);
        });
      }

      const rAppSlugBinding = await ensureAppSlugItem(vctx, req, { onProgress: emitProgress });
      if (rAppSlugBinding.isErr()) {
        return Result.Err(rAppSlugBinding);
      }

      // const res = rAppSlugBinding.Ok();
      // if (isResEnsureAppSlugOk(res)) {
      // console.log("ensureAppSlugItem success", req.appSlug, '===', res.appSlug, req.userSlug, '===', res.userSlug);
      // }

      await ctx.send.send(ctx, rAppSlugBinding.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
