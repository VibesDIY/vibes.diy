import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqPinRecentVibe,
  ReqPinRecentVibe,
  ReqWithVerifiedAuth,
  ResPinRecentVibe,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, and } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";

export const pinRecentVibeEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqPinRecentVibe>, ResPinRecentVibe | VibesDiyError> = {
  hash: "pin-recent-vibe",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqPinRecentVibe(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPinRecentVibe>>, ResPinRecentVibe | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const usb = vctx.sql.tables.userSlugBinding;
      const asb = vctx.sql.tables.appSlugBinding;

      const appRow = await vctx.sql.db
        .select({ userSlug: asb.userSlug, appSlug: asb.appSlug })
        .from(asb)
        .innerJoin(usb, and(eq(usb.userSlug, asb.userSlug), eq(usb.userId, userId)))
        .where(and(eq(asb.userSlug, req.userSlug), eq(asb.appSlug, req.appSlug)))
        .limit(1)
        .then((r) => r[0]);
      if (!appRow) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `not found or not authorized to pin ${req.userSlug}/${req.appSlug}`,
          code: "pin-recent-vibe-not-found",
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const pinnedAt = req.pin ? new Date().toISOString() : "";
      await vctx.sql.db
        .update(asb)
        .set({ pinnedAt })
        .where(and(eq(asb.userSlug, req.userSlug), eq(asb.appSlug, req.appSlug)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-pin-recent-vibe",
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        pinnedAt,
      } satisfies ResPinRecentVibe);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
