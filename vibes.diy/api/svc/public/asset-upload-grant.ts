import { EventoHandler, Result, HandleTriggerCtx, EventoResultType, Option, EventoResult, BuildURI } from "@adviser/cement";
import {
  MsgBase,
  VibesDiyError,
  W3CWebSocketEvent,
  ReqAssetUploadGrant,
  ResAssetUploadGrant,
  isReqAssetUploadGrant,
  ReqWithVerifiedAuth,
} from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { canWrite, checkDocAccess } from "./access-helpers.js";

const GRANT_TTL_SEC = 60;

// Build the absolute URL the client will POST bytes to. Prefer the
// configured VIBES_DIY_API_URL (production / dev share this path); fall
// back to the relative `/assets` when env is incomplete (tests). Either
// way, the client's POST hits processRequest's `/assets` handler.
function buildUploadUrl(vctx: VibesApiSQLCtx): string {
  const base = vctx.params.vibes.env.VIBES_DIY_API_URL;
  if (!base) return "/assets";
  return BuildURI.from(base).appendRelative("/assets").toString();
}

export const assetUploadGrantEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqAssetUploadGrant>,
  ResAssetUploadGrant | VibesDiyError
> = {
  hash: "asset-upload-grant",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqAssetUploadGrant(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqAssetUploadGrant>>,
        ResAssetUploadGrant | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Upload requires write access to (userSlug, appSlug). Public-readable
      // apps don't grant write — uploaders must be owner/editor/submitter.
      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (!canWrite(access)) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const jti = vctx.sthis.timeOrderedNextId().str;
      const rSigned = await vctx.assetGrantSigner.sign(
        {
          jti,
          userId,
          userSlug: req.userSlug,
          appSlug: req.appSlug,
          ...(req.mimeType !== undefined ? { mimeType: req.mimeType } : {}),
        },
        GRANT_TTL_SEC
      );
      if (rSigned.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Failed to mint grant: ${rSigned.Err().message}` },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }
      const { token, expiresAt } = rSigned.Ok();

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-asset-upload-grant",
        uploadUrl: buildUploadUrl(vctx),
        grant: token,
        expiresAt: expiresAt.toISOString(),
        uploadId: jti,
      } satisfies ResAssetUploadGrant);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
