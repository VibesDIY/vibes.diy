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

// One renderable section of a turn, kept with its blockSeq for ordering.
interface AppChatSection {
  blockSeq: number;
  blocks: PromptAndBlockMsgs[];
}

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

      // Ownership gate. The ApplicationChats row anchors this chat to the caller
      // (and supplies the appSlug/ownerHandle echoed back). It does NOT hold the
      // transcript: `ApplicationChats.blocks` is initialized to `[]` on creation
      // and is never updated — runtime/img prompt streaming persists its events
      // into ChatSections instead (see prompt-chat-section.ts). So this row is
      // used only to authorize and scope the read.
      const conditions: SQL[] = [
        eq(vctx.sql.tables.applicationChats.userId, userId),
        eq(vctx.sql.tables.applicationChats.chatId, req.chatId),
      ];
      if (req.appSlug) conditions.push(eq(vctx.sql.tables.applicationChats.appSlug, req.appSlug));
      if (req.ownerHandle) conditions.push(eq(vctx.sql.tables.applicationChats.ownerHandle, req.ownerHandle));

      const appRows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.applicationChats.chatId,
          appSlug: vctx.sql.tables.applicationChats.appSlug,
          ownerHandle: vctx.sql.tables.applicationChats.ownerHandle,
        })
        .from(vctx.sql.tables.applicationChats)
        .where(and(...conditions))
        .limit(1);

      if (appRows.length === 0) {
        // Unknown / cross-app chatId — return empty blocks, not an error (mirrors
        // getChatDetails empty prompts; avoids turning this into an existence oracle).
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-application-chat",
          blocks: [],
        } satisfies ResGetApplicationChat);
        return Result.Ok(EventoResult.Continue);
      }
      const appRow = appRows[0];

      // The transcript lives in ChatSections, keyed by this chatId (the same
      // table the codegen deep-read uses, but here gated by the ApplicationChats
      // ownership check above rather than by ChatContexts). LEFT JOIN
      // PromptContexts for the turn timestamp so a turn that errored before
      // handlePromptContext inserted its row still orders by its section's own
      // `created`.
      const sectionRows = await vctx.sql.db
        .select({
          promptId: vctx.sql.tables.chatSections.promptId,
          blockSeq: vctx.sql.tables.chatSections.blockSeq,
          sectionCreated: vctx.sql.tables.chatSections.created,
          promptCreated: vctx.sql.tables.promptContexts.created,
          blocks: vctx.sql.tables.chatSections.blocks,
        })
        .from(vctx.sql.tables.chatSections)
        .leftJoin(
          vctx.sql.tables.promptContexts,
          and(
            eq(vctx.sql.tables.promptContexts.chatId, vctx.sql.tables.chatSections.chatId),
            eq(vctx.sql.tables.promptContexts.promptId, vctx.sql.tables.chatSections.promptId)
          )
        )
        .where(eq(vctx.sql.tables.chatSections.chatId, req.chatId));

      // Group sections into turns, then flatten chronologically (oldest-first)
      // into a single block stream: turns ordered by `created`, sections within a
      // turn by `blockSeq`. This reproduces the verbatim runtime/img order.
      const turns = new Map<string, { created: string; sections: AppChatSection[] }>();
      for (const row of sectionRows) {
        let turn = turns.get(row.promptId);
        if (turn === undefined) {
          turn = { created: row.promptCreated ?? row.sectionCreated, sections: [] };
          turns.set(row.promptId, turn);
        }
        const { filtered: blocks, warning } = parseArrayWarning(row.blocks, PromptAndBlockMsgs);
        if (warning.length > 0) {
          ensureLogger(vctx.sthis, "getApplicationChat").Warn().Any({ parseErrors: warning }).Msg("skip");
        }
        turn.sections.push({ blockSeq: row.blockSeq, blocks });
      }
      for (const turn of turns.values()) {
        turn.sections.sort((a, b) => a.blockSeq - b.blockSeq);
      }
      const blocks = Array.from(turns.values())
        .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0))
        .flatMap((turn) => turn.sections.flatMap((section) => section.blocks));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-application-chat",
        chatId: appRow.chatId,
        appSlug: appRow.appSlug,
        ownerHandle: appRow.ownerHandle,
        blocks,
      } satisfies ResGetApplicationChat);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
