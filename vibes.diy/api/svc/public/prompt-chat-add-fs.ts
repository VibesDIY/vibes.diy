import { EventoHandler, Result, Option, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  InMsgBase,
  MsgBase,
  ReqAddFS,
  reqAddFS,
  ReqWithVerifiedAuth,
  ResAddFS,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
// import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";

export const promptChatAddFS: EventoHandler<W3CWebSocketEvent, MsgBase<ReqAddFS>, unknown> = {
  hash: "prompt-chat-add-fs-handler",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqAddFS(msg.payload);
    if (ret instanceof type.errors) {
      // console.error("Validation error in promptChatAddFS:", ret.summary, msg.payload);
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
    async (ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqAddFS>>, never | VibesDiyError>) => {
      console.log("Handling promptChatAddFS with ctx:", ctx);
      const req = ctx.validated.payload;
      // TODO: implement
      // const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.res-add-fs",
            chatId: req.chatId,
            appSlug: "string",
            userSlug: "string",
            mode: "dev" as const,
            fsId: "string",
            outerTid: req.outerTid,
          },
          tid: ctx.validated.tid,
          src: "promptChatAddFS",
        }) satisfies InMsgBase<ResAddFS>
      );
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
