import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import { reqAppendChatSection, ReqAppendChatSection, ResAppendChatSection, VibesDiyError } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlChatContexts, sqlChatSections } from "../sql/vibes-diy-api-schema.js";
import { eq, max } from "drizzle-orm";

export const appendChatSection: EventoHandler<Request, ReqAppendChatSection, ResAppendChatSection | VibesDiyError> = {
  hash: "append-chat-section",
  validate: unwrapMsgBase(async (payload: unknown) => {
    const ret = reqAppendChatSection(payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(ret));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<Request, ReqWithVerifiedAuth<ReqAppendChatSection>, ResAppendChatSection | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rAppend = await appendChatSectionToContext(vctx, {
        userId: req.auth.verifiedAuth.claims.userId,
        contextId: req.contextId,
        origin: req.origin,
        blocks: req.blocks,
      });
      if (rAppend.isErr()) {
        return Result.Err(rAppend);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-append-chat-section",
        contextId: req.contextId,
        seq: rAppend.Ok(),
        origin: req.origin,
      } satisfies ResAppendChatSection);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

interface AppendChatSectionParam {
  userId: string;
  contextId: string;
  origin: "user" | "llm";
  blocks: ReqAppendChatSection["blocks"];
}

async function appendChatSectionToContext(ctx: VibesApiSQLCtx, param: AppendChatSectionParam): Promise<Result<number>> {
  return exception2Result(async (): Promise<Result<number>> => {
    // Verify the context exists and belongs to this user
    const existingContext = await ctx.db.select().from(sqlChatContexts).where(eq(sqlChatContexts.contextId, param.contextId)).get();

    if (!existingContext) {
      return Result.Err("contextId does not exist");
    }
    if (existingContext.userId !== param.userId) {
      return Result.Err("contextId does not belong to this user");
    }

    // Get the current max seq for this context
    const maxSeqResult = await ctx.db
      .select({ maxSeq: max(sqlChatSections.seq) })
      .from(sqlChatSections)
      .where(eq(sqlChatSections.contextId, param.contextId))
      .get();

    // Increment seq (start at 0 if no sections exist)
    const newSeq = (maxSeqResult?.maxSeq ?? -1) + 1;

    // Insert the new chat section
    await ctx.db
      .insert(sqlChatSections)
      .values({
        contextId: param.contextId,
        seq: newSeq,
        origin: param.origin,
        blocks: param.blocks,
        created: new Date().toISOString(),
      })
      .run();

    return Result.Ok(newSeq);
  });
}
