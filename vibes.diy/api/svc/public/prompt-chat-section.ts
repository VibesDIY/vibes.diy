import { EventoHandler, Result, Option, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  InMsgBase,
  MsgBase,
  ReqPromptChatSection,
  reqPromptChatSection,
  ResPromptChatSection,
  SectionEvent,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../api.ts";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.ts";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { sqlChatContexts, sqlChatSections } from "../sql/vibes-diy-api-schema.ts";
import { eq, max } from "drizzle-orm";

export const promptChatSection: EventoHandler<W3CWebSocketEvent, MsgBase<ReqPromptChatSection>, never | VibesDiyError> = {
  hash: "prompt-chat-section-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // console.log("Validating promptChatSection with payload:", ctx.enRequest);
    const ret = reqPromptChatSection(msg.payload);
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
    async (ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>) => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const resChat = await vctx.db.select().from(sqlChatContexts).where(eq(sqlChatContexts.chatId, req.chatId)).get();
      if (!resChat) {
        return Result.Err(`Chat ID ${req.chatId} not found`);
      }
      if (resChat.userId !== req.auth.verifiedAuth.claims.userId) {
        return Result.Err(`Chat ID ${req.chatId} does not belong to the user`);
      }
      const promptId = vctx.sthis.nextId(12).str;
      const maxSectionResult = await vctx.db
        .select({ maxSectionId: max(sqlChatSections.sectionId) })
        .from(sqlChatSections)
        .where(eq(sqlChatSections.chatId, req.chatId))
        .get();
      const sectionId = (maxSectionResult?.maxSectionId ?? -1) + 1;
      const rPrompt = await exception2Result(() =>
        vctx.db.insert(sqlChatSections).values({
          chatId: req.chatId,
          promptId,
          sectionId,
          blocks: [req.prompt],
          created: new Date().toISOString(),
        })
      );
      if (rPrompt.isErr()) {
        return Result.Err(`Failed to append chat section: ${rPrompt.Err().message}`);
      }
      ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.res-prompt-chat-section",
            chatId: req.chatId,
            promptId,
            sectionId,
            outerTid: req.outerTid,
            prompt: req.prompt,
          },
          tid: ctx.validated.tid,
          src: "promptChatSection",
        } satisfies InMsgBase<ResPromptChatSection>)
      );

      ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.section-event",
            chatId: req.chatId,
            promptId,
            sectionId,
            blocks: [req.prompt],
          },
          tid: req.outerTid,
          src: "promptChatSection",
        } satisfies InMsgBase<SectionEvent>)
      );
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
