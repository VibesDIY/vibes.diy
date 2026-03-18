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
import { sqlApplicationChats } from "../sql/vibes-diy-api-schema.js";
import { eq, and, lt, desc, SQL } from "drizzle-orm";

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

      const conditions: SQL[] = [eq(sqlApplicationChats.userId, userId)];
      if (req.appSlug) conditions.push(eq(sqlApplicationChats.appSlug, req.appSlug));
      if (req.userSlug) conditions.push(eq(sqlApplicationChats.userSlug, req.userSlug));
      if (req.cursor) conditions.push(lt(sqlApplicationChats.created, req.cursor));

      // Fetch limit+1 to detect whether a next page exists
      const rows = await vctx.db
        .select({
          chatId: sqlApplicationChats.chatId,
          appSlug: sqlApplicationChats.appSlug,
          userSlug: sqlApplicationChats.userSlug,
          created: sqlApplicationChats.created,
        })
        .from(sqlApplicationChats)
        .where(and(...conditions))
        .orderBy(desc(sqlApplicationChats.created))
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
