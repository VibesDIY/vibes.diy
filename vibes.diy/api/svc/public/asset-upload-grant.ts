import { EventoHandler, Result, HandleTriggerCtx, EventoResultType, Option, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  VibesDiyError,
  ResError,
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

// `POST /assets` lives at the host root (sibling of `/assets/cid`) — *not*
// under `/api/` because that path goes to the ChatSessions DO which only
// handles WS upgrades + a DocNotify POST shape. The host root is
// VIBES_DIY_PUBLIC_BASE_URL, set in api-svc env. Tests fall back to the
// relative path; they exercise the handler via `processRequest()` directly
// and ignore uploadUrl.
function buildUploadUrl(vctx: VibesApiSQLCtx): string {
  const base = vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL;
  if (!base) return "/assets";
  return `${base.replace(/\/+$/, "")}/assets`;
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

      // Upload requires write access to (ownerHandle, appSlug). Public-readable
      // apps don't grant write — uploaders must be owner/editor/submitter.
      const { access } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
      if (!canWrite(access)) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const jti = vctx.sthis.timeOrderedNextId().str;
      const rSigned = await vctx.assetGrantSigner.sign(
        {
          jti,
          userId,
          ownerHandle: req.ownerHandle,
          appSlug: req.appSlug,
          ...(req.mimeType !== undefined ? { mimeType: req.mimeType } : {}),
        },
        GRANT_TTL_SEC
      );
      if (rSigned.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Failed to mint grant: ${rSigned.Err().message}` },
        } satisfies ResError);
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
