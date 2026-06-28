import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetApplicationChat,
  ReqGetApplicationChat,
  ReqWithVerifiedAuth,
  ResGetApplicationChat,
  VibesDiyError,
  W3CWebSocketEvent,
  PromptAndBlockMsgs,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { ensureLogger } from "@vibes.diy/identity";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and } from "drizzle-orm/sql/expressions";
import type { SQL } from "drizzle-orm/sql";

export const getApplicationChatEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetApplicationChat>,
  ResGetApplicationChat | VibesDiyError
> = {
  hash: "get-application-chat",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetApplicationChat(msg.payload);
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
        MsgBase<ReqWithVerifiedAuth<ReqGetApplicationChat>>,
        ResGetApplicationChat | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const conditions: SQL[] = [
        eq(vctx.sql.tables.applicationChats.userId, userId),
        eq(vctx.sql.tables.applicationChats.chatId, req.chatId),
      ];
      if (req.appSlug) conditions.push(eq(vctx.sql.tables.applicationChats.appSlug, req.appSlug));
      if (req.ownerHandle) conditions.push(eq(vctx.sql.tables.applicationChats.ownerHandle, req.ownerHandle));

      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.applicationChats.chatId,
          appSlug: vctx.sql.tables.applicationChats.appSlug,
          ownerHandle: vctx.sql.tables.applicationChats.ownerHandle,
          blocks: vctx.sql.tables.applicationChats.blocks,
        })
        .from(vctx.sql.tables.applicationChats)
        .where(and(...conditions))
        .limit(1);

      if (rows.length === 0) {
        // No row found — return empty blocks, not an error (mirrors getChatDetails empty prompts)
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-application-chat",
          blocks: [],
        } satisfies ResGetApplicationChat);
        return Result.Ok(EventoResult.Continue);
      }

      const row = rows[0];
      const { filtered: blocks, warning: blocksWarning } = parseArrayWarning(row.blocks, PromptAndBlockMsgs);
      if (blocksWarning.length > 0) {
        ensureLogger(vctx.sthis, "getApplicationChat").Warn().Any({ parseErrors: blocksWarning }).Msg("skip");
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-application-chat",
        chatId: row.chatId,
        appSlug: row.appSlug,
        ownerHandle: row.ownerHandle,
        blocks,
      } satisfies ResGetApplicationChat);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
