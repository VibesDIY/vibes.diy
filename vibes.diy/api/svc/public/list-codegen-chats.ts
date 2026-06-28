import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListCodegenChats,
  ReqListCodegenChats,
  ReqWithVerifiedAuth,
  ResListCodegenChats,
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

export const listCodegenChats: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListCodegenChats>,
  ResListCodegenChats | VibesDiyError
> = {
  hash: "list-codegen-chats",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListCodegenChats(msg.payload);
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
        MsgBase<ReqWithVerifiedAuth<ReqListCodegenChats>>,
        ResListCodegenChats | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const limit = Math.min(req.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      const conditions: SQL[] = [eq(vctx.sql.tables.chatContexts.userId, userId)];
      if (req.appSlug) conditions.push(eq(vctx.sql.tables.chatContexts.appSlug, req.appSlug));
      if (req.ownerHandle) conditions.push(eq(vctx.sql.tables.chatContexts.ownerHandle, req.ownerHandle));
      if (req.cursor) conditions.push(lt(vctx.sql.tables.chatContexts.created, req.cursor));

      // Fetch limit+1 to detect whether a next page exists
      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.chatContexts.chatId,
          appSlug: vctx.sql.tables.chatContexts.appSlug,
          ownerHandle: vctx.sql.tables.chatContexts.ownerHandle,
          created: vctx.sql.tables.chatContexts.created,
        })
        .from(vctx.sql.tables.chatContexts)
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.chatContexts.created))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-codegen-chats",
        items,
        ...(hasMore ? { nextCursor: items[items.length - 1].created } : {}),
      } satisfies ResListCodegenChats);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
