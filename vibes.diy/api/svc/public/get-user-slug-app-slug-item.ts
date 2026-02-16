import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetByUserSlugAppSlug,
  ReqGetByUserSlugAppSlug,
  ResGetByUserSlugAppSlug,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase as unwrapMsgBase } from "../unwrap-msg-base.ts";
import { VibesApiSQLCtx } from "../types.ts";
import { ReqWithVerifiedAuth, checkAuth as checkAuth } from "../check-auth.ts";
import { sqlAppSlugBinding, sqlChatContexts, sqlChatSections, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.ts";
import { eq, and } from "drizzle-orm";
import { BlockEndMsg, BlockMsgs, isBlockEnd, isCodeEnd } from "@vibes.diy/call-ai-v2";

export const getByUserSlugAppSlugItemEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetByUserSlugAppSlug>,
  ResGetByUserSlugAppSlug | VibesDiyError
> = {
  hash: "get-by-userSlug-appSlug",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // async (ctx): Promise<Result<Option<ReqEnsureAppSlug>>> => {
    const ret = reqGetByUserSlugAppSlug(msg.payload);
    // console.log("validate ensureAppSlugItem", payload, ret);
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
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqGetByUserSlugAppSlug>>,
        ResGetByUserSlugAppSlug | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      // console.log("handle ensureAppSlugItem", ctx.validated);
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (req.sectionId) {
        const chat = await vctx.db
          .select()
          .from(sqlUserSlugBinding)
          .innerJoin(sqlAppSlugBinding, eq(sqlAppSlugBinding.userSlug, sqlUserSlugBinding.userSlug))
          .innerJoin(sqlChatContexts, and(
            eq(sqlChatContexts.userSlug, sqlUserSlugBinding.userSlug), 
            eq(sqlChatContexts.appSlug, sqlAppSlugBinding.appSlug)))
          .innerJoin(sqlChatSections,eq(sqlChatSections.chatId, sqlChatContexts.chatId))
          .where(and(
            eq(sqlUserSlugBinding.userSlug, req.userSlug), 
            eq(sqlAppSlugBinding.appSlug, req.appSlug),
            eq(sqlUserSlugBinding.userId, req.auth.verifiedAuth.claims.userId)
          ))
          // .groupBy(sqlChatSections.chatId, sqlChatSections.promptId)
          .orderBy(sqlChatSections.blockSeq)
            .all()
          
        let foundBlockEnd: BlockEndMsg | undefined = undefined;
        let waitBlockEnd = false;
        for (const { ChatSections } of chat) {
          // console.log(`checking chat context`, ChatSections)
          for (const block of ChatSections.blocks as BlockMsgs[]) {
            if (isCodeEnd(block) && block.sectionId === req.sectionId) {
              console.log(`checking codeblock`, block)
              waitBlockEnd = true
            }
            if (waitBlockEnd && isBlockEnd(block)) {
              console.log(`checking blockend`, block)
              foundBlockEnd = block;
              break;
            }
          }
          if (foundBlockEnd) {
            break;
          }
        }
        if (foundBlockEnd && foundBlockEnd.fsRef) {
          console.log(`foundBlockEnd`, foundBlockEnd)
          await ctx.send.send(ctx, {
            entryPointUrl: foundBlockEnd.fsRef.entryPointUrl,
            type: "vibes.diy.res-get-by-user-slug-app-slug",
            fsId: foundBlockEnd.fsRef.fsId,
            sectionId: req.sectionId,
            appSlug: req.appSlug,
            userSlug: req.userSlug,
            mode: foundBlockEnd.fsRef.mode,
            wrapperUrl: foundBlockEnd.fsRef.wrapperUrl,
          } satisfies ResGetByUserSlugAppSlug);
          return Result.Ok(EventoResult.Continue);
        }
      }
      return Result.Err(`getByUserSlugAppSlugItemEvento only supports retrieval by sectionId for now`);
    }
  ),
};
