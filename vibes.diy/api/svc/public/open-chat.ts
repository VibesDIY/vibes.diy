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
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { ensureChatId } from "../intern/ensure-chat-id.js";
import { resendChatSectionsPrevMsg } from "../intern/resend-prev-msg.js";
import { ensureApplicationChatId } from "../intern/ensure-application-chat-id.js";

export const openChat: EventoHandler<W3CWebSocketEvent, MsgBase<ReqOpenChat>, ResOpenChat | VibesDiyError> = {
  hash: "open-chat-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // console.log("openChat validate called", msg);
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
      // console.log("openChat handler called", ctx.validated.payload);
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (req.mode === "creation") {
        // this path is for in dev-mode where a new chat in dev console
        const rChatId = await ensureChatId(vctx, req);
        if (rChatId.isErr()) {
          return Result.Err(rChatId);
        }
        const { appSlug, userSlug, chatId } = rChatId.Ok();

        const wsp = ctx.send.provider as WSSendProvider;
        console.log("openChat: Adding chatId to WSSendProvider", chatId, ctx.validated.tid);
        wsp.chatIds.add({ chatId, tid: ctx.validated.tid });

        const rReSend = await resendChatSectionsPrevMsg({
          vctx,
          chatId,
          tid: ctx.validated.tid,
          dst: ctx.validated.src,
          send: (msg: MsgBase<SectionEvent>) => {
            return ctx.send.send(ctx, msg);
          },
        });
        if (rReSend.isErr()) {
          console.error("Error in resendChatSectionsPrevMsg", rReSend.Err());
          // We can choose to continue even if resending previous messages fails
          // return Result.Err(rReSend.Err());
        }
        const resOpenChat = await ctx.send.send(ctx, {
          type: "vibes.diy.res-open-chat",
          chatId,
          appSlug,
          userSlug,
          mode: req.mode,
        } satisfies ResOpenChat);
        if (resOpenChat.isErr()) {
          return Result.Err(resOpenChat);
        }
        return Result.Ok(EventoResult.Continue);
      }
      if (req.mode === "application") {
        const { appSlug, userSlug } = ctx.validated.payload;
        if (!appSlug || !userSlug) {
          return Result.Err(`appSlug and userSlug are required for application mode`);
        }
        // is are prompts from the application which will run
        // in the userId context which could be different from
        // the creator of the app
        const rChatId = await ensureApplicationChatId(vctx, req);
        if (rChatId.isErr()) {
          return Result.Err(rChatId);
        }
        const { chatId: newChatId, blocks, created } = rChatId.Ok();
        const rCurrentMsg: Result<SendStatItem<MsgBase<SectionEvent>>> = await ctx.send.send(ctx, {
          payload: {
            type: "vibes.diy.section-event",
            chatId: newChatId,
            promptId: newChatId, // for simplicity we use chatId as promptId for the first section
            blockSeq: 0,
            timestamp: created,
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

        const wsp = ctx.send.provider as WSSendProvider;
        console.log("openChat: Adding chatId to WSSendProvider", newChatId, ctx.validated.tid);
        wsp.chatIds.add({ chatId: newChatId, tid: ctx.validated.tid });

        const resOpenChat = await ctx.send.send(ctx, {
          type: "vibes.diy.res-open-chat",
          chatId: newChatId,
          appSlug,
          userSlug,
          mode: req.mode,
        } satisfies ResOpenChat);
        if (resOpenChat.isErr()) {
          return Result.Err(resOpenChat);
        }

        return Result.Ok(EventoResult.Continue);
      }
      return Result.Err(`Invalid mode: ${req.mode}`);
    }
  ),
};
