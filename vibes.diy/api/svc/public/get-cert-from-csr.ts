import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { MsgBase, reqGetCertFromCsr, ReqGetCertFromCsr, ResGetCertFromCsr, ResError, VibesDiyError, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";

export const getCertFromCsrEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetCertFromCsr>,
  ResGetCertFromCsr | VibesDiyError
> = {
  hash: "get-cert-from-csr",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetCertFromCsr(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqGetCertFromCsr>>, ResGetCertFromCsr | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rCert = await vctx.deviceCA.processCSR(req.csr, req.auth.verifiedAuth.claims);
      if (rCert.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `CSR processing failed: ${rCert.Err()}`,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-cert-from-csr",
        certificate: rCert.Ok().certificateJWT,
      } satisfies ResGetCertFromCsr);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
