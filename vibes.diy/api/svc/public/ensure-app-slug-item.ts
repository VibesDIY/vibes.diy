import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  to_uint8,
} from "@adviser/cement";
import {
  reqEnsureAppSlug,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  VibeFile,
  VibesDiyError,
} from "vibes-diy-api-pkg";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { sha256 } from "multiformats/hashes/sha2";
import { base58btc } from "multiformats/bases/base58";
import { VibesApiSQLCtx } from "../api.ts";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";


export const ensureAppSlugItem: EventoHandler<
  Request,
  ReqEnsureAppSlug,
  ResEnsureAppSlug | VibesDiyError
> = {
  hash: "ensure-cloud-token",
  validate: unwrapMsgBase(async (payload: unknown) => {
    // async (ctx): Promise<Result<Option<ReqEnsureAppSlug>>> => {
    const ret = reqEnsureAppSlug(payload);
    // console.log("validate ensureAppSlugItem", payload, ret);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(ret));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        Request,
        ReqWithVerifiedAuth<ReqEnsureAppSlug>,
        ResEnsureAppSlug | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      // console.log("handle ensureAppSlugItem", ctx.validated);
      const req = ctx.validated;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
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
      }[] = [];
      for (const fsItem of req.fileSystem) {
        switch (fsItem.type) {
          case "code-block":
          case "str-asset-block":
          case "uint8-asset-block":
            {
              const uint8Content = to_uint8(fsItem.content);
              const hash = await sha256.digest(uint8Content);
              const cid = base58btc.encode(hash.digest);
              writeAppSlugsOp.push({
                fsItem,
                assetOp: {
                  cid,
                  data: uint8Content,
                },
              });
            }
            break;
          case "uint8-asset-ref":
          case "code-ref":
          case "str-asset-ref":
          default:
            // needs to rewind content from ref
            return Result.Err(
              `unsupported file system item type: ${fsItem.type}`
            );
        }
      }
      const rStorageResult = await vctx.ensureStorage(
        ...writeAppSlugsOp.map((op) => op.assetOp)
      );
      if (rStorageResult.isErr()) {
        return Result.Err(rStorageResult);
      }
      if (rStorageResult.Ok().length !== writeAppSlugsOp.length) {
        return Result.Err("storage result count mismatch");
      }
      const storageResults = rStorageResult.Ok();
      const fullFileSystem = writeAppSlugsOp.map((op, idx) => ({
        fsItem: op.fsItem,
        storage: storageResults[idx],
      }));
      const res = await ensureApps(
        vctx,
        req,
        rAppSlugBinding.Ok(),
        fullFileSystem
      );
      if (res.isErr()) {
        return Result.Err(res);
      }
      // console.log("ensureAppSlugItem res", res.Ok());
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-ensure-app-slug",
        appSlug: rAppSlugBinding.Ok().appSlug,
        userSlug: rAppSlugBinding.Ok().userSlug,
        mode: req.mode,
        fsId: res.Ok().fsId,
        env: req.env ?? {},
        fileSystem: res.Ok().fileSystem,
        wrapperUrl: "string",
        entryPointUrl: "string",
      } satisfies ResEnsureAppSlug);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
