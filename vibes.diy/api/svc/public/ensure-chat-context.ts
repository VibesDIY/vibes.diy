import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import { reqEnsureChatContext, ReqEnsureChatContext, ResEnsureChatContext, VibesDiyError } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../api.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlChatContexts } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm";

export const ensureChatContext: EventoHandler<Request, ReqEnsureChatContext, ResEnsureChatContext | VibesDiyError> = {
  hash: "ensure-chat-context",
  validate: unwrapMsgBase(async (payload: unknown) => {
    const ret = reqEnsureChatContext(payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(ret));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<Request, ReqWithVerifiedAuth<ReqEnsureChatContext>, ResEnsureChatContext | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rContextId = await ensureChatContextId(vctx, {
        userId: req.auth.verifiedAuth.claims.userId,
        contextId: req.contextId,
      });
      if (rContextId.isErr()) {
        return Result.Err(rContextId);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-ensure-chat-context",
        contextId: rContextId.Ok(),
      } satisfies ResEnsureChatContext);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

interface ChatContextParam {
  userId: string;
  contextId?: string;
}

async function ensureChatContextId(ctx: VibesApiSQLCtx, param: ChatContextParam): Promise<Result<string>> {
  return exception2Result(async (): Promise<Result<string>> => {
    if (param.contextId) {
      // Check if the provided contextId exists and belongs to this user
      const existing = await ctx.db.select().from(sqlChatContexts).where(eq(sqlChatContexts.contextId, param.contextId)).get();

      if (existing) {
        // Context exists - verify it belongs to this user
        if (existing.userId !== param.userId) {
          return Result.Err("contextId does not belong to this user");
        }
        return Result.Ok(param.contextId);
      }
      // Context doesn't exist - create it with the provided contextId
    }

    // Use provided contextId or generate a new one
    const contextId = param.contextId ?? ctx.sthis.nextId(12).str;
    await ctx.db
      .insert(sqlChatContexts)
      .values({
        contextId,
        userId: param.userId,
        created: new Date().toISOString(),
      })
      .run();
    return Result.Ok(contextId);
  });
}
