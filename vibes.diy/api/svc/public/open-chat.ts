import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  canonicalModelUsage,
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
import { assertChatShardIdentity } from "../shard-gate.js";
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
      let chatPromise: Promise<Result<{ appSlug: string; ownerHandle: string; chatId: string }>>;
      // Normalize the wire mode (legacy or canonical) before routing; the
      // response below still echoes the caller's original `req.mode` (#2618).
      switch (canonicalModelUsage(req.mode)) {
        case "codegen":
          chatPromise = ensureChatId(vctx, req);
          break;
        case "runtime":
        case "img":
          chatPromise = ensureApplicationChatId({ ctx: vctx, req });
          break;
        default:
          return Result.Err(`Invalid mode: ${req.mode}`);
      }
      const rChatId = await chatPromise;
      if (rChatId.isErr()) {
        return Result.Err(rChatId);
      }
      const { appSlug, ownerHandle, chatId } = rChatId.Ok();
      // console.log("openChat: Obtained chatId", chatId, "for appSlug:", appSlug, "ownerHandle:", ownerHandle, "mode:", req.mode);

      // Post-resolution shard-identity gate (#2714). open-chat's canonical target
      // is only known after the chat lookup above; on the vibe shard (img-gen
      // rides AppSessions), assert the resolved app addresses THIS shard before
      // any streaming work — the split-brain defense for chat ops.
      const oErr = assertChatShardIdentity(ctx, ownerHandle, appSlug);
      if (oErr.IsSome()) {
        await ctx.send.send(ctx, oErr.unwrap());
        return Result.Ok(EventoResult.Continue);
      }

      const wsp = ctx.send.provider as WSSendProvider;
      // console.log("openChat: Adding chatId to WSSendProvider", chatId, ctx.validated.tid);
      let chatCtx = wsp.chatIds.get(chatId);
      if (!chatCtx) {
        chatCtx = { chatId, tids: new Set([ctx.validated.tid]), promptIds: new Map() };
        wsp.chatIds.set(chatId, chatCtx);
      } else {
        chatCtx.tids.add(ctx.validated.tid);
      }

      const rReSend = await resendChatSectionsPrevMsg({
        vctx,
        chatCtx,
        tid: ctx.validated.tid,
        dst: ctx.validated.src,
        send: (msg: MsgBase<SectionEvent>) => {
          // console.log("Resending previous section event message for chatId:", chatId, "message:", msg);
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
        ownerHandle,
        mode: req.mode,
      } satisfies ResOpenChat);
      if (resOpenChat.isErr()) {
        return Result.Err(resOpenChat);
      }
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
