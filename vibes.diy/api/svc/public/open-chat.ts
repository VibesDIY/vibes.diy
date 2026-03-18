import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqOpenChat,
  reqOpenChat,
  ReqWithVerifiedAuth,
  ResOpenChat,
  SectionEvent,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth as checkAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { ensureChatId } from "../intern/ensure-chat-id.js";
import { resendChatSectionsPrevMsg } from "../intern/resend-prev-msg.js";
import { ensureApplicationChatId } from "../intern/ensure-application-chat-id.js";

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
      // console.log("openChat handler called", ctx.validated.payload);
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      let chatPromise: Promise<Result<{ appSlug: string; userSlug: string; chatId: string }>>;
      switch (req.mode) {
        case "creation":
          chatPromise = ensureChatId(vctx, req);
          break;
        case "application":
          chatPromise = ensureApplicationChatId({ ctx: vctx, req });
          break;
        default:
          return Result.Err(`Invalid mode: ${req.mode}`);
      }
      const rChatId = await chatPromise;
      if (rChatId.isErr()) {
        return Result.Err(rChatId);
      }
      const { appSlug, userSlug, chatId } = rChatId.Ok();
      // console.log("openChat: Obtained chatId", chatId, "for appSlug:", appSlug, "userSlug:", userSlug, "mode:", req.mode);

      const wsp = ctx.send.provider as WSSendProvider;
      // console.log("openChat: Adding chatId to WSSendProvider", chatId, ctx.validated.tid);
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
  ),
};
