import { EventoHandler, Result, HandleTriggerCtx, EventoResultType, Option, EventoResult } from "@adviser/cement";
import { VibesApiSQLCtx } from "../types.js";
import { MsgBase, ReqWithVerifiedAuth, VibesDiyError, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { ReqCertFromCsr, ResCertFromCsr } from "@fireproof/core-types-protocols-dashboard";

/**
 * Get certificate from CSR
 * Validates the CSR and signs it using the DeviceIdCA to create a certificate
 */
async function getCertFromCsr(ctx: VibesApiSQLCtx, req: ReqWithVerifiedAuth<ReqCertFromCsr>): Promise<Result<ResCertFromCsr>> {
  // Process the CSR using the DeviceIdCA
  const rCert = await ctx.deviceCA.processCSR(req.csr, req._auth.verifiedAuth.claims);
  if (rCert.isErr()) {
    return Result.Err(rCert.Err());
  }
  const certResult = rCert.Ok();
  // Return the signed certificate JWT
  return Result.Ok({
    type: "resCertFromCsr",
    certificate: certResult.certificateJWT,
  });
}

export const getCertFromCsrEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqCertFromCsr>, ResCertFromCsr | VibesDiyError> = {
  hash: "get-cert-from-csr",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = (msg.payload as { type: string }).type === "reqCertFromCsr";
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: msg.payload as unknown as ReqCertFromCsr,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqCertFromCsr>>, ResCertFromCsr | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const res = await getCertFromCsr(vctx, req);
      console.log("getCertFromCsr result:", res);
      if (res.isErr()) {
        return Result.Err(res);
      }

      await ctx.send.send(ctx, res.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
