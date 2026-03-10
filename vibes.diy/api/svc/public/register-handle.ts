import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqRegisterHandle,
  ReqRegisterHandle,
  ResRegisterHandle,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { ensureUserSlug } from "../intern/ensure-slug-binding.js";
import { and, eq } from "drizzle-orm";
import { sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";

function normalizeRequestedSlug(value: string | undefined): Result<string | undefined> {
  if (typeof value === "undefined") {
    return Result.Ok(undefined);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return Result.Err("Handle slug must not be empty");
  }
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (withoutAt.length === 0) {
    return Result.Err("Handle slug must not be empty");
  }
  return Result.Ok(withoutAt);
}

export async function registerHandle(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqRegisterHandle>
): Promise<Result<ResRegisterHandle>> {
  const userId = req.auth.verifiedAuth.claims.userId;
  const rSlug = normalizeRequestedSlug(req.userSlug);
  if (rSlug.isErr()) {
    return Result.Err(rSlug.Err());
  }
  const normalized = rSlug.Ok();

  if (typeof normalized === "string") {
    const existingBySlug = await vctx.db
      .select()
      .from(sqlUserSlugBinding)
      .where(eq(sqlUserSlugBinding.userSlug, normalized))
      .get();
    if (existingBySlug && existingBySlug.userId !== userId) {
      return Result.Err(`Handle @${normalized} is already taken`);
    }
  }

  const rEnsured = await ensureUserSlug(vctx, {
    userId,
    userSlug: normalized,
  });
  if (rEnsured.isErr()) {
    return Result.Err(rEnsured.Err());
  }
  const userSlug = rEnsured.Ok();

  const row = await vctx.db
    .select()
    .from(sqlUserSlugBinding)
    .where(and(eq(sqlUserSlugBinding.userId, userId), eq(sqlUserSlugBinding.userSlug, userSlug)))
    .get();
  if (!row) {
    return Result.Err(`Handle registration failed for @${userSlug}`);
  }

  return Result.Ok({
    type: "vibes.diy.res-register-handle",
    userId: row.userId,
    userSlug: row.userSlug,
    created: row.created,
  });
}

export const registerHandleEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqRegisterHandle>,
  ResRegisterHandle | VibesDiyError
> = {
  hash: "register-handle",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqRegisterHandle(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRegisterHandle>>, ResRegisterHandle | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rHandle = await registerHandle(vctx, req);
      if (rHandle.isErr()) {
        return Result.Err(rHandle.Err());
      }

      await ctx.send.send(ctx, rHandle.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
