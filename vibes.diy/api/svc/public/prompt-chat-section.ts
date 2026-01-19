import { EventoHandler, Result, Option, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  InMsgBase,
  MsgBase,
  PromptAndBlockMsgs,
  ReqPromptChatSection,
  reqPromptChatSection,
  ResPromptChatSection,
  SectionEvent,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { unwrapMsgBase, wrapMsgBase } from "../unwrap-msg-base.js";
import { sqlChatContexts, sqlChatSections } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm";
import {
  createStatsCollector,
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  createSectionsStream,
  isBlockBegin,
  isBlockEnd,
  isBlockImage,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isToplevelBegin,
  isToplevelEnd,
  isToplevelLine,
  isBlockStats,
} from "@vibes.diy/call-ai-v2";

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
      const promptId = vctx.sthis.nextId(96 / 8).str;
      // needs to be sent before any block events
      // to allow the client to associate incoming blocks with the promptId
      ctx.send.send(
        ctx,
        wrapMsgBase(ctx.validated, {
          payload: {
            type: "vibes.diy.res-prompt-chat-section",
            chatId: req.chatId,
            userSlug: resChat.userSlug,
            appSlug: resChat.appSlug,
            promptId,
            outerTid: req.outerTid,
          },
          tid: ctx.validated.tid,
          src: "promptChatSection",
        } satisfies InMsgBase<ResPromptChatSection>)
      );

      let blockSeq = 0;
      // console.log("0-Created promptId:", promptId, "for chatId:", req.chatId);
      const rBegin = await appendBlockEvent({
        ctx,
        vctx,
        req,
        promptId,
        blockSeq: blockSeq,
        evt: {
          type: "prompt.block-begin",
          streamId: promptId,
          chatId: req.chatId,
          // streamId:
          seq: blockSeq,
          timestamp: new Date(),
        },
      });
      blockSeq++;
      if (rBegin.isErr()) {
        return Result.Err(rBegin);
      }

      // console.log("1-Created promptId:", promptId, "for chatId:", req.chatId);
      const r = await appendBlockEvent({
        ctx,
        vctx,
        req,
        promptId,
        blockSeq: blockSeq,
        evt: {
          type: "prompt.req",
          streamId: promptId,
          chatId: req.chatId,
          seq: blockSeq,
          request: req.prompt,
          timestamp: new Date(),
        },
      });
      blockSeq++;
      if (r.isErr()) {
        console.error("Failed to append prompt request event:", r.Err());
        return Result.Err(r);
      }

      // console.log("Sending LLM request for promptId:", promptId);

      // add system prompt here
      const rRes = await exception2Result(() => vctx.llmRequest(req.prompt));
      if (rRes.isErr()) {
        return Result.Err(`LLM request failed: ${rRes.Err().message}`);
      }
      const res = rRes.Ok();
      if (!res.ok) {
        return Result.Err(`LLM request failed with status ${res.status}`);
      }
      if (!res.body) {
        return Result.Err(`LLM request returned no body`);
      }
      const pipeline = res.body
        .pipeThrough(createStatsCollector(promptId, 100000))
        .pipeThrough(createLineStream(promptId))
        .pipeThrough(createDataStream(promptId))
        .pipeThrough(createSseStream(promptId))
        .pipeThrough(createDeltaStream(promptId, () => vctx.sthis.nextId().str))
        .pipeThrough(createSectionsStream(promptId, () => vctx.sthis.nextId().str));

      const reader = pipeline.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // console.log("Finished reading LLM response stream");
          break;
        }
        if (isBlockStats(value)) {
          // console.log("LLM Stats:", value.stats);
          const r = await appendBlockEvent({ ctx, vctx, req, promptId, blockSeq: blockSeq++, evt: value, emitMode: "emit-only" });
          if (r.isErr()) {
            return Result.Err(r);
          }
        }
        if (
          isBlockBegin(value) ||
          isToplevelBegin(value) ||
          isCodeBegin(value) ||
          isToplevelLine(value) ||
          isCodeLine(value) ||
          isToplevelEnd(value) ||
          isCodeEnd(value) ||
          isBlockImage(value) ||
          isBlockEnd(value)
        ) {
          // console.log("Appending block event:", req);
          const r = await appendBlockEvent({ ctx, vctx, req, promptId, blockSeq: blockSeq++, evt: value });
          if (r.isErr()) {
            return Result.Err(r);
          }
        }
      }
      if (blockSeq > 1) {
        const rEnd = await appendBlockEvent({
          ctx,
          vctx,
          req,
          promptId,
          blockSeq: blockSeq,
          evt: {
            type: "prompt.block-end",
            streamId: promptId,
            chatId: req.chatId,
            // streamId:
            seq: blockSeq,
            timestamp: new Date(),
          },
        });
        blockSeq++;
        if (rEnd.isErr()) {
          return Result.Err(rEnd);
        }
      }

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

interface AppendBlockEventParams {
  ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPromptChatSection>>, never | VibesDiyError>;
  vctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqPromptChatSection>;
  promptId: string;
  blockSeq: number;
  evt: PromptAndBlockMsgs;
  emitMode?: "store" | "emit-only";
}

async function appendBlockEvent({
  ctx,
  vctx,
  req,
  promptId,
  blockSeq,
  evt,
  emitMode = "store",
}: AppendBlockEventParams): Promise<Result<void>> {
  const now = new Date();
  // console.log("Appending block event:", { promptId, blockSeq, evt, timestamp: now });
  const msgBase = wrapMsgBase(ctx.validated, {
    payload: {
      type: "vibes.diy.section-event",
      chatId: req.chatId,
      promptId,
      blockSeq,
      blocks: [evt],
      timestamp: now,
    },
    tid: req.outerTid,
    src: "promptChatSection",
  } satisfies InMsgBase<SectionEvent>);
  for (const conn of vctx.connections) {
    for (const tuple of conn.chatIds) {
      if (tuple.chatId === req.chatId) {
        console.log("promptChatSection: Sending blockSeq", blockSeq, "to chatId:", req.chatId, "via tid:", tuple.tid);
        await conn.send(ctx, { ...msgBase, tid: tuple.tid });
      }
    }
  }
  if (emitMode === "store") {
    // Store block in DB
    const rUpdate = await exception2Result(() =>
      vctx.db
        .insert(sqlChatSections)
        .values({
          chatId: req.chatId,
          promptId,
          blockSeq,
          blocks: [evt],
          created: now.toISOString(),
        })
        .run()
    );
    if (rUpdate.isErr()) {
      return Result.Err(rUpdate);
    }
  }
  return Result.Ok();
}
