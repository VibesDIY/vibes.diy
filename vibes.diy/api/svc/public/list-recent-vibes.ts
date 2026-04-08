import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListRecentVibes,
  ReqListRecentVibes,
  ReqWithVerifiedAuth,
  ResListRecentVibes,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, desc } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm/sql";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export const listRecentVibesEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListRecentVibes>,
  ResListRecentVibes | VibesDiyError
> = {
  hash: "list-recent-vibes",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListRecentVibes(msg.payload);
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
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListRecentVibes>>,
        ResListRecentVibes | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      const rows = await vctx.sql.db
        .select({
          userSlug: vctx.sql.tables.chatContexts.userSlug,
          appSlug: vctx.sql.tables.chatContexts.appSlug,
          lastActive: sql<string>`max(${vctx.sql.tables.chatSections.created})`.as("lastActive"),
        })
        .from(vctx.sql.tables.chatContexts)
        .innerJoin(
          vctx.sql.tables.chatSections,
          eq(vctx.sql.tables.chatSections.chatId, vctx.sql.tables.chatContexts.chatId)
        )
        .where(eq(vctx.sql.tables.chatContexts.userId, userId))
        .groupBy(vctx.sql.tables.chatContexts.userSlug, vctx.sql.tables.chatContexts.appSlug)
        .orderBy(desc(sql`lastActive`))
        .limit(limit);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-recent-vibes",
        items: rows,
      } satisfies ResListRecentVibes);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
