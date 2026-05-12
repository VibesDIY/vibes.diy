import { EventoHandler, EventoResult, EventoResultType, HandleTriggerCtx, Option, Result } from "@adviser/cement";
import {
  MsgBase,
  ReqInspectPromptChatSection,
  ReqWithVerifiedAuth,
  ResInspectPromptChatSection,
  VibesDiyError,
  W3CWebSocketEvent,
  reqInspectPromptChatSection,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { getModelDefaults } from "../intern/get-model-defaults.js";
import { assemblePromptPayload } from "./prompt-chat-section.js";

export const inspectPromptChatSection: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqInspectPromptChatSection>,
  ResInspectPromptChatSection | VibesDiyError
> = {
  hash: "inspect-prompt-chat-section-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqInspectPromptChatSection(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqInspectPromptChatSection>>,
        ResInspectPromptChatSection | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Ownership check mirrors the chat-mode branch of getResChatFromMode
      // in prompt-chat-section.ts: chatContexts row joined on (userId, chatId).
      const row = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.chatContexts)
        .where(
          and(
            eq(vctx.sql.tables.chatContexts.userId, req._auth.verifiedAuth.claims.userId),
            eq(vctx.sql.tables.chatContexts.chatId, req.chatId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      if (!row) {
        return Result.Err(`Chat ID ${req.chatId} not found`);
      }

      const rDefaults = await getModelDefaults(vctx, { appSlug: row.appSlug, userSlug: row.userSlug });
      if (rDefaults.isErr()) return Result.Err(rDefaults);
      const modelId = req.prompt.model ?? rDefaults.Ok().chat.model.id;

      const rPayload = await assemblePromptPayload(vctx, {
        chatId: req.chatId,
        model: modelId,
        newUserMessages: req.prompt.messages,
      });
      if (rPayload.isErr()) return Result.Err(rPayload);
      const payload = rPayload.Ok();

      await ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          tid: ctx.validated.tid,
          payload: {
            type: "vibes.diy.res-inspect-prompt-chat-section",
            chatId: req.chatId,
            model: payload.model,
            messages: payload.messages,
          } satisfies ResInspectPromptChatSection,
        })
      );
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
