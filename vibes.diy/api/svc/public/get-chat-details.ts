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
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlChatContexts, sqlChatSections, sqlPromptContexts, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";
import { eq, and, desc } from "drizzle-orm";
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
      const userId = req.auth.verifiedAuth.claims.userId;

      // Single query: verify ownership via UserSlugBinding, get chatId from ChatContexts,
      // fsId/created from PromptContexts, and blocks from ChatSections
      const rows = await vctx.db
        .select({
          chatId: sqlChatContexts.chatId,
          promptId: sqlPromptContexts.promptId,
          fsId: sqlPromptContexts.fsId,
          created: sqlPromptContexts.created,
          blocks: sqlChatSections.blocks,
        })
        .from(sqlUserSlugBinding)
        .innerJoin(sqlChatContexts, eq(sqlChatContexts.userSlug, sqlUserSlugBinding.userSlug))
        .innerJoin(sqlPromptContexts, eq(sqlPromptContexts.chatId, sqlChatContexts.chatId))
        .innerJoin(
          sqlChatSections,
          and(eq(sqlChatSections.chatId, sqlPromptContexts.chatId), eq(sqlChatSections.promptId, sqlPromptContexts.promptId))
        )
        .where(
          and(
            eq(sqlUserSlugBinding.userId, userId),
            eq(sqlChatContexts.userSlug, req.userSlug),
            eq(sqlChatContexts.appSlug, req.appSlug)
          )
        )
        .orderBy(desc(sqlPromptContexts.created))
        .all();

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
