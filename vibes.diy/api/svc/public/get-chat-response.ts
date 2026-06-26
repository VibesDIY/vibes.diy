import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetChatResponse,
  ReqGetChatResponse,
  ResChatResponseSection,
  ResChatResponseTurn,
  ResGetChatResponse,
  VibesDiyError,
  W3CWebSocketEvent,
  PromptAndBlockMsgs,
  ReqWithVerifiedAuth,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { ensureLogger } from "@vibes.diy/identity";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, desc } from "drizzle-orm/sql/expressions";

// Read-only sibling to getChatDetails. Where getChatDetails distills the last
// user message and throws the model's blocks away, this returns the full
// stored section stream (`ChatSections.blocks`) grouped by turn so the CLI can
// reconstruct the verbatim model response, replay it through the shared
// generate/edit resolver (`resolveSectionStream`) for `--files`, or dump the
// raw block events as jsonl. See VibesDIY/vibes.diy#2655.
export const getChatResponseEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetChatResponse>,
  ResGetChatResponse | VibesDiyError
> = {
  hash: "get-chat-response",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetChatResponse(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqGetChatResponse>>, ResGetChatResponse | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Same ownership join as getChatDetails (HandleBinding → ChatContexts →
      // PromptContexts → ChatSections), but we keep the blocks instead of
      // distilling them. One row per section (blockSeq); ordered newest-turn
      // first (created desc). Sections within a turn are sorted by blockSeq in
      // JS below (rows of one turn share `created`, so they stay contiguous).
      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.chatContexts.chatId,
          promptId: vctx.sql.tables.promptContexts.promptId,
          fsId: vctx.sql.tables.promptContexts.fsId,
          created: vctx.sql.tables.promptContexts.created,
          blockSeq: vctx.sql.tables.chatSections.blockSeq,
          blocks: vctx.sql.tables.chatSections.blocks,
        })
        .from(vctx.sql.tables.handleBinding)
        .innerJoin(vctx.sql.tables.chatContexts, eq(vctx.sql.tables.chatContexts.ownerHandle, vctx.sql.tables.handleBinding.handle))
        .innerJoin(vctx.sql.tables.promptContexts, eq(vctx.sql.tables.promptContexts.chatId, vctx.sql.tables.chatContexts.chatId))
        .innerJoin(
          vctx.sql.tables.chatSections,
          and(
            eq(vctx.sql.tables.chatSections.chatId, vctx.sql.tables.promptContexts.chatId),
            eq(vctx.sql.tables.chatSections.promptId, vctx.sql.tables.promptContexts.promptId)
          )
        )
        .where(
          and(
            eq(vctx.sql.tables.handleBinding.userId, userId),
            eq(vctx.sql.tables.chatContexts.ownerHandle, req.ownerHandle),
            eq(vctx.sql.tables.chatContexts.appSlug, req.appSlug),
            ...(req.chatId !== undefined ? [eq(vctx.sql.tables.chatContexts.chatId, req.chatId)] : []),
            ...(req.promptId !== undefined ? [eq(vctx.sql.tables.promptContexts.promptId, req.promptId)] : [])
          )
        )
        .orderBy(desc(vctx.sql.tables.promptContexts.created));

      // Group section rows into turns, preserving newest-first turn order.
      const turns = new Map<string, ResChatResponseTurn>();
      for (const row of rows) {
        let turn = turns.get(row.promptId);
        if (turn === undefined) {
          turn = {
            chatId: row.chatId,
            promptId: row.promptId,
            created: row.created,
            ...(row.fsId !== undefined && row.fsId !== null ? { fsId: row.fsId } : {}),
            sections: [],
          };
          turns.set(row.promptId, turn);
        }
        const { filtered: blocks, warning } = parseArrayWarning(row.blocks, PromptAndBlockMsgs);
        if (warning.length > 0) {
          ensureLogger(vctx.sthis, "getChatResponse").Warn().Any({ parseErrors: warning }).Msg("skip");
        }
        const section: ResChatResponseSection = { blockSeq: row.blockSeq, blocks };
        turn.sections.push(section);
      }

      // Order each turn's sections by blockSeq so the block stream rebuilds in
      // emission order regardless of how the DB returned the rows.
      for (const turn of turns.values()) {
        turn.sections.sort((a, b) => a.blockSeq - b.blockSeq);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-chat-response",
        ...(req.chatId !== undefined ? { chatId: req.chatId } : {}),
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        turns: Array.from(turns.values()),
      } satisfies ResGetChatResponse);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
