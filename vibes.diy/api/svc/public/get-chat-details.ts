import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetChatDetails,
  ReqGetChatDetails,
  ResChatDetailsPrompt,
  ResGetChatDetails,
  VibesDiyError,
  W3CWebSocketEvent,
  PromptAndBlockMsgs,
  ReqWithVerifiedAuth,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, desc } from "drizzle-orm/sql/expressions";
import { isPromptReq } from "@vibes.diy/call-ai-v2";

export const getChatDetailsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetChatDetails>,
  ResGetChatDetails | VibesDiyError
> = {
  hash: "get-chat-details",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetChatDetails(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqGetChatDetails>>, ResGetChatDetails | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Single query: verify ownership via UserSlugBinding, get chatId from ChatContexts,
      // fsId/created from PromptContexts, and blocks from ChatSections
      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.chatContexts.chatId,
          promptId: vctx.sql.tables.promptContexts.promptId,
          fsId: vctx.sql.tables.promptContexts.fsId,
          created: vctx.sql.tables.promptContexts.created,
          blocks: vctx.sql.tables.chatSections.blocks,
        })
        .from(vctx.sql.tables.userSlugBinding)
        .innerJoin(
          vctx.sql.tables.chatContexts,
          eq(vctx.sql.tables.chatContexts.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
        )
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
            eq(vctx.sql.tables.userSlugBinding.userId, userId),
            eq(vctx.sql.tables.chatContexts.userSlug, req.userSlug),
            eq(vctx.sql.tables.chatContexts.appSlug, req.appSlug)
          )
        )
        .orderBy(desc(vctx.sql.tables.promptContexts.created));

      if (rows.length === 0) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-chat-details",
          chatId: "",
          userSlug: req.userSlug,
          appSlug: req.appSlug,
          prompts: [],
        } satisfies ResGetChatDetails);
        return Result.Ok(EventoResult.Continue);
      }

      // Group by promptId: collect prompt text from blocks, take fsId/created from first row
      const chatId = rows[0].chatId;
      const seen = new Map<string, ResChatDetailsPrompt>();
      for (const row of rows) {
        if (!row.fsId) continue;
        if (!seen.has(row.promptId)) {
          seen.set(row.promptId, { prompt: "", fsId: row.fsId, created: row.created });
        }
        const entry = seen.get(row.promptId);
        // Already found prompt text for this promptId, skip block parsing
        if (!entry || entry.prompt) continue;
        const msgs = PromptAndBlockMsgs.array()(row.blocks);
        if (msgs instanceof type.errors) continue;
        for (const msg of msgs) {
          if (isPromptReq(msg)) {
            const userMsgs = msg.request.messages.filter((m) => m.role === "user");
            const lastUserMsg = userMsgs[userMsgs.length - 1];
            if (lastUserMsg) {
              const text = lastUserMsg.content
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("\n");
              if (text) {
                entry.prompt = text;
              }
            }
            break;
          }
        }
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-chat-details",
        chatId,
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        prompts: Array.from(seen.values()),
      } satisfies ResGetChatDetails);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
