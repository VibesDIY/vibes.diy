import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, SendStatItem } from "@adviser/cement";
import {
  MsgBase,
  ReqOpenChat,
  reqOpenChat,
  ResOpenChat,
  SectionEvent,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.ts";
import { VibesApiSQLCtx } from "../api.ts";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.ts";
import { sqlChatContexts, sqlChatSections } from "../sql/vibes-diy-api-schema.ts";
import { eq } from "drizzle-orm";
import { ensureAppSlug, ensureUserSlug } from "../intern/ensure-slug-binding.ts";
import { PromptMsg } from "@vibes.diy/call-ai-v2";

export const openChat: EventoHandler<W3CWebSocketEvent, MsgBase<ReqOpenChat>, ResOpenChat | VibesDiyError> = {
  hash: "open-chat-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqOpenChat(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqOpenChat>>, ResOpenChat | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      let appSlug: string;
      let userSlug: string;
      let chatId: string | undefined;
      if (req.chatId) {
        const result = await vctx.db.select().from(sqlChatContexts).where(eq(sqlChatContexts.chatId, req.chatId)).get();
        if (!result) {
          return Result.Err(`Chat ID ${req.chatId} not found`);
        }
        if (result.userId !== req.auth.verifiedAuth.claims.userId) {
          return Result.Err(`Chat ID ${req.chatId} does not belong to the user`);
        }
        appSlug = result.appSlug;
        userSlug = result.userSlug;
        chatId = result.chatId;
      } else {
        const resUser = await ensureUserSlug(vctx, {
          userId: req.auth.verifiedAuth.claims.userId,
          userSlug: req.userSlug,
        });
        if (resUser.isErr()) {
          return Result.Err(`Failed to ensure userSlug: ${resUser.Err().message}`);
        }
        userSlug = resUser.Ok();

        const resApp = await ensureAppSlug(vctx, {
          userId: req.auth.verifiedAuth.claims.userId,
          userSlug: userSlug,
          appSlug: req.appSlug,
        });
        if (resApp.isErr()) {
          return Result.Err(`Failed to ensure appSlug: ${resApp.Err().message}`);
        }
        appSlug = resApp.Ok();
      }

      if (!chatId) {
        chatId = vctx.sthis.nextId(12).str;
        await vctx.db
          .insert(sqlChatContexts)
          .values({
            chatId,
            userId: req.auth.verifiedAuth.claims.userId,
            appSlug,
            userSlug,
            created: new Date().toISOString(),
          })
          .run();
      }

      const sections = await vctx.db
        .select()
        .from(sqlChatSections)
        .where(eq(sqlChatSections.chatId, chatId))
        .orderBy(sqlChatSections.created, sqlChatSections.sectionId)
        .all();
      let currentMsg: MsgBase<SectionEvent> | undefined = undefined;
      for (const section of sections) {
        if (currentMsg && currentMsg.payload.promptId !== section.promptId) {
          ctx.send.send(ctx, {
            ...currentMsg,
            payload: {
              ...currentMsg.payload,
              blocks: [], // indicate new prompt started
            },
          } satisfies MsgBase<SectionEvent>);
        }
        const blocks = PromptMsg.array()(section.blocks);
        if (blocks instanceof type.errors) {
          return Result.Err(`Invalid blocks data for section ${section.sectionId} in chat ${section.chatId}`);
        }
        const rCurrentMsg: Result<SendStatItem<MsgBase<SectionEvent>>> = await ctx.send.send(ctx, {
          payload: {
            type: "vibes.diy.section-event",
            chatId: section.chatId,
            promptId: section.promptId,
            sectionId: section.sectionId,
            blocks,
          },
          tid: ctx.validated.tid,
          src: "openChat",
          dst: ctx.validated.src,
          ttl: 6,
        } satisfies MsgBase<SectionEvent>);
        if (rCurrentMsg.isErr()) {
          return Result.Err(rCurrentMsg);
        }
        if (rCurrentMsg.Ok().item.isErr()) {
          return Result.Err(rCurrentMsg.Ok().item);
        }
        currentMsg = rCurrentMsg.Ok().item.Ok();
      }
      if (currentMsg) {
        ctx.send.send(ctx, {
          ...currentMsg,
          payload: {
            ...currentMsg.payload,
            blocks: [], // indicate new prompt started
          },
        } satisfies MsgBase<SectionEvent>);
      }

      const resOpenChat = await ctx.send.send(ctx, {
        type: "vibes.diy.res-open-chat",
        chatId,
        appSlug,
        userSlug,
      } satisfies ResOpenChat);
      if (resOpenChat.isErr()) {
        return Result.Err(resOpenChat);
      }

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
