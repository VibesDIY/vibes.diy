import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { reqListUserSlugs, ReqListUserSlugs, ResListUserSlugs } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { listUserSlugs as listUserSlugsDb } from "../intern/ensure-slug-binding.js";

export const listUserSlugs: EventoHandler<Request, ReqListUserSlugs, ResListUserSlugs> = {
  hash: "list-user-slugs",
  validate: unwrapMsgBase(async (payload: unknown) => {
    const ret = reqListUserSlugs(payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(ret));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<Request, ReqWithVerifiedAuth<ReqListUserSlugs>, ResListUserSlugs>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rSlugs = await listUserSlugsDb(vctx, req.auth.verifiedAuth.claims.userId);

      if (rSlugs.isErr()) {
        return Result.Err(rSlugs);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-user-slugs",
        slugs: rSlugs.Ok(),
      } satisfies ResListUserSlugs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
