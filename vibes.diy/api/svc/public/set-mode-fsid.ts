import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  ReqSetModeFs,
  reqSetModeFs,
  ReqWithVerifiedAuth,
  ResSetModeFs,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { eq, and } from "drizzle-orm/sql/expressions";

export async function setModeFsId(vctx: VibesApiSQLCtx, req: ReqSetModeFs, userId: string): Promise<Result<ResSetModeFs>> {
  if (req.mode === "production") {
    // Reset any existing production row for this app back to dev first
    const rReset = await exception2Result(() =>
      vctx.db
        .update(sqlApps)
        .set({ mode: "dev" })
        .where(
          and(
            eq(sqlApps.userId, userId),
            eq(sqlApps.userSlug, req.userSlug),
            eq(sqlApps.appSlug, req.appSlug),
            eq(sqlApps.mode, "production")
          )
        )
        .run()
    );
    if (rReset.isErr()) {
      return Result.Err(rReset);
    }
  }
  const rUpdate = await exception2Result(() =>
    vctx.db
      .update(sqlApps)
      .set({ mode: req.mode })
      .where(
        and(
          eq(sqlApps.userId, userId),
          eq(sqlApps.userSlug, req.userSlug),
          eq(sqlApps.appSlug, req.appSlug),
          eq(sqlApps.fsId, req.fsId)
        )
      )
      .run()
  );
  if (rUpdate.isErr()) {
    return Result.Err(rUpdate);
  }
  return Result.Ok({
    type: "vibes.diy.res-set-mode-fs",
    fsId: req.fsId,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
    mode: req.mode,
  } satisfies ResSetModeFs);
}

export const setModeFsIdEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqSetModeFs>, ResSetModeFs | VibesDiyError> = {
  hash: "set-mode-fsid",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSetModeFs(msg.payload);
    if (ret instanceof type.errors) {
      if ((msg.payload as { type: string }).type === "vibes.diy.req-set-mode-fs") {
        console.log(`set-mode-fsid`, msg.payload, ret.summary);
      }
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqSetModeFs>>, ResSetModeFs | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rResult = await setModeFsId(vctx, req as unknown as ReqSetModeFs, req._auth.verifiedAuth.claims.userId);
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }

      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
