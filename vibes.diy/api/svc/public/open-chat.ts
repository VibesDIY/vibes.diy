import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  SendStatItem,
  exception2Result,
} from "@adviser/cement";
import {
  MsgBase,
  PromptAndBlockMsgs,
  ReqOpenChat,
  reqOpenChat,
  ResOpenChat,
  SectionEvent,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.js";
import { sqlChatContexts, sqlChatSections } from "../sql/vibes-diy-api-schema.js";
import { eq, and } from "drizzle-orm";
import { ensureAppSlug, ensureUserSlug } from "../intern/ensure-slug-binding.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";

// function ensureChatId(chatId: string | undefined): Result<string | undefined> {
//   if (!chatId) {
//     return Result.Ok(undefined);
//   }
//   if (typeof chatId !== "string") {
//     return Result.Err(new VibesDiyError(`Invalid chatId type: ${typeof chatId}`));
//   }

//         if (!chatId) {
//         chatId = vctx.sthis.nextId(12).str;
//         await vctx.db
//           .insert(sqlChatContexts)
//           .values({
//             chatId,
//             userId: req.auth.verifiedAuth.claims.userId,
//             appSlug,
//             userSlug,
//             created: new Date().toISOString(),
//           })
//           .run();
//       }

// }

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

      let appSlug: string;
      let userSlug: string;
      let chatId: string | undefined;
      let condition;
      if (req.chatId) {
        condition = eq(sqlChatContexts.chatId, req.chatId);
      } else {
        if (req.userSlug && req.appSlug) {
          condition = and(eq(sqlChatContexts.userSlug, req.userSlug), eq(sqlChatContexts.appSlug, req.appSlug));
        }
        if (req.appSlug) {
          condition = eq(sqlChatContexts.appSlug, req.appSlug);
        }
      }
      if (condition) {
        // console.log("openChat looking for Existing chat with condition", req);
        const rResult = await exception2Result(() =>
          vctx.db
            .select()
            .from(sqlChatContexts)
            .where(and(condition, eq(sqlChatContexts.userId, req.auth.verifiedAuth.claims.userId)))
            .all()
        );
        if (rResult.isErr()) {
          return Result.Err(`Failed to query existing chat: ${rResult.Err().message}`);
        }
        const result = rResult.Ok();
        // console.log("openChat existing chat query result", result);
        if (result.length !== 1) {
          return Result.Err(`Chat ID ${req.chatId} not found`);
        }
        // if (result.userId !== req.auth.verifiedAuth.claims.userId) {
        // return Result.Err(`Chat ID ${req.chatId} does not belong to the user`);
        // }
        appSlug = result[0].appSlug;
        userSlug = result[0].userSlug;
        chatId = result[0].chatId;
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
      }
      const wsp = ctx.send.provider as WSSendProvider;
      console.log("openChat: Adding chatId to WSSendProvider", chatId, ctx.validated.tid);
      wsp.chatIds.add({ chatId, tid: ctx.validated.tid });

      const sections = await vctx.db
        .select()
        .from(sqlChatSections)
        .where(eq(sqlChatSections.chatId, chatId))
        // .groupBy(sqlChatSections.chatId, sqlChatSections.promptId)
        .orderBy(sqlChatSections.created, sqlChatSections.promptId, sqlChatSections.blockSeq)
        .all();
      for (const section of sections) {
        const blocks = PromptAndBlockMsgs.array()(section.blocks);
        if (blocks instanceof type.errors) {
          return Result.Err(`Invalid blocks data for section ${section.blockSeq} in chat ${section.chatId} - ${blocks.summary}`);
        }
        const rCurrentMsg: Result<SendStatItem<MsgBase<SectionEvent>>> = await ctx.send.send(ctx, {
          payload: {
            type: "vibes.diy.section-event",
            chatId: section.chatId,
            promptId: section.promptId,
            blockSeq: section.blockSeq,
            timestamp: new Date(section.created),
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
