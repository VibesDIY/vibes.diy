import { EventoResultType, HandleTriggerCtx, Result } from "@adviser/cement";
import {
  DashAuthType,
  VerifiedAuthResult,
  VerifiedClaimsResult,
  VerifiedResult,
  WithAuth,
} from "@fireproof/core-types-protocols-dashboard";
import { ClerkClaimSchema } from "@fireproof/core-types-base";
import { VibesApiSQLCtx } from "./types.js";
import { MsgBase } from "@vibes.diy/api-types";

export type ReqWithVerifiedAuth<REQ extends { type: string; auth: DashAuthType }> = Omit<REQ, "auth"> & {
  readonly auth: VerifiedAuthResult;
};

export type ReqWithOptionalAuth<REQ extends { type: string; auth?: DashAuthType }> = Omit<REQ, "auth"> & {
  readonly auth?: VerifiedAuthResult;
};

export async function verifyExtractClaims(
  ctx: VibesApiSQLCtx,
  req: { readonly auth: DashAuthType }
): Promise<Result<VerifiedClaimsResult>> {
  const tokenApi = ctx.tokenApi[req.auth.type];
  if (!tokenApi) {
    return Result.Err(`invalid auth type:[${req.auth.type}]`);
  }
  const rAuth = await tokenApi.verify(req.auth.token);
  if (rAuth.isErr()) {
    return Result.Err(rAuth.Err());
  }
  return Result.Ok({
    type: req.auth.type,
    token: req.auth.token,
    claims: rAuth.Ok().claims,
  });
}

export function corercedVerifiedAuthUser(ver: VerifiedClaimsResult): Result<VerifiedAuthResult["verifiedAuth"]> {
  switch (ver.type) {
    case "device-id":
    case "clerk": {
      const claims = ClerkClaimSchema.safeParse(ver.claims);
      if (!claims.success) {
        return Result.Err(claims.error);
      }
      return Result.Ok({
        type: "clerk",
        claims: claims.data,
      });
    }

    default:
      return Result.Err(`unsupported verified auth type:[${ver.type}]`);
  }
}

export async function verifyAuth(
  ctx: VibesApiSQLCtx,
  req: WithAuth
  // status: UserStatus[] = ["active"],
): Promise<Result<VerifiedResult>> {
  const rvec = await verifyExtractClaims(ctx, req);
  if (rvec.isErr()) {
    return Result.Err(rvec.Err());
  }
  const rVerifiedAuth = corercedVerifiedAuthUser(rvec.Ok());
  if (rVerifiedAuth.isErr()) {
    return Result.Err(rVerifiedAuth.Err());
  }
  // console.log("verifyAuth", rVerifiedAuth.Ok());
  // const rExisting = await getUser(ctx.db, rVerifiedAuth.Ok().claims.userId);
  // if (rExisting.isErr()) {
  //   if (isUserNotFound(rExisting)) {
  //     return Result.Ok({
  //       type: "VerifiedAuthResult",
  //       inDashAuth: req.auth,
  //       verifiedAuth: rVerifiedAuth.Ok(),
  //     });
  //   }
  //   return Result.Err(rExisting);
  // }
  // if (!status.includes(rExisting.Ok().status)) {
  //   return Result.Err(`user status invalid: ${rExisting.Ok().status}`);
  // }
  return Result.Ok({
    type: "VerifiedAuthResult",
    inDashAuth: req.auth,
    verifiedAuth: rVerifiedAuth.Ok(),
    // user: rExisting.Ok(),
  });
}

export function optAuth<IReq, TReq extends MsgBase<X>, TRes, X extends { type: string; auth?: DashAuthType }>(
  fn: (ctx: HandleTriggerCtx<IReq, MsgBase<ReqWithOptionalAuth<X>>, TRes>) => Promise<Result<EventoResultType>>
): (ctx: HandleTriggerCtx<IReq, TReq, TRes>) => Promise<Result<EventoResultType>> {
  return async (ctx: HandleTriggerCtx<IReq, TReq, TRes>) => {
    const payload = ctx.validated.payload;
    if (payload.auth) {
      const rAuth = await verifyAuth(ctx.ctx.getOrThrow("vibesApiCtx"), payload as WithAuth);
      if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
        (payload as unknown as { auth: VerifiedResult }).auth = rAuth.Ok();
      } else {
        // Auth provided but invalid — treat as unauthenticated
        (payload as unknown as { auth: undefined }).auth = undefined;
      }
    }
    return fn(ctx as unknown as HandleTriggerCtx<IReq, MsgBase<ReqWithOptionalAuth<X>>, TRes>);
  };
}

export function checkAuth<IReq, TReq extends MsgBase<X>, TRes, X extends WithAuth & { type: string }>(
  fn: (ctx: HandleTriggerCtx<IReq, MsgBase<ReqWithVerifiedAuth<X>>, TRes>) => Promise<Result<EventoResultType>>
): (ctx: HandleTriggerCtx<IReq, TReq, TRes>) => Promise<Result<EventoResultType>> {
  return optAuth<IReq, TReq, TRes, X>((async (ctx) => {
    const payload = ctx.validated.payload;
    if (!payload.auth) {
      console.error("checkAuth: auth required but not verified");
      return Result.Err("authentication required");
    }
    return fn(ctx as unknown as HandleTriggerCtx<IReq, MsgBase<ReqWithVerifiedAuth<X>>, TRes>);
  }) as (ctx: HandleTriggerCtx<IReq, MsgBase<ReqWithOptionalAuth<X>>, TRes>) => Promise<Result<EventoResultType>>);
}
