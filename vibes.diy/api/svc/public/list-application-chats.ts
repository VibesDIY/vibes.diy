import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListApplicationChats,
  ReqListApplicationChats,
  ReqWithVerifiedAuth,
  ResListApplicationChats,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, desc } from "drizzle-orm/sql/expressions";
import type { SQL } from "drizzle-orm/sql";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const listApplicationChats: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListApplicationChats>,
  ResListApplicationChats | VibesDiyError
> = {
  hash: "list-application-chats",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListApplicationChats(msg.payload);
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
        MsgBase<ReqWithVerifiedAuth<ReqListApplicationChats>>,
        ResListApplicationChats | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      const conditions: SQL[] = [eq(vctx.sql.tables.applicationChats.userId, userId)];
      if (req.appSlug) conditions.push(eq(vctx.sql.tables.applicationChats.appSlug, req.appSlug));
      if (req.userSlug) conditions.push(eq(vctx.sql.tables.applicationChats.userSlug, req.userSlug));
      if (req.cursor) conditions.push(lt(vctx.sql.tables.applicationChats.created, req.cursor));

      // Fetch limit+1 to detect whether a next page exists
      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.applicationChats.chatId,
          appSlug: vctx.sql.tables.applicationChats.appSlug,
          userSlug: vctx.sql.tables.applicationChats.userSlug,
          created: vctx.sql.tables.applicationChats.created,
        })
        .from(vctx.sql.tables.applicationChats)
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.applicationChats.created))
        .limit(limit + 1)
        .all();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-application-chats",
        items,
        ...(hasMore ? { nextCursor: items[items.length - 1].created } : {}),
      } satisfies ResListApplicationChats);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
