import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { ensureUserSlug, ensureAppSlug } from "./ensure-slug-binding.js";
import { ReqOpenChat, ReqWithVerifiedAuth } from "@vibes.diy/api-types";

interface EnsureChatIdPResult {
  appSlug: string;
  userSlug: string;
  chatId: string;
}

export async function ensureChatId(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqOpenChat>
): Promise<Result<EnsureChatIdPResult>> {
  let appSlug: string;
  let userSlug: string;
  let chatId: string | undefined;
  let condition;
  if (req.chatId) {
    condition = eq(ctx.sql.tables.chatContexts.chatId, req.chatId);
  } else {
    if (req.userSlug && req.appSlug) {
      condition = and(eq(ctx.sql.tables.chatContexts.userSlug, req.userSlug), eq(ctx.sql.tables.chatContexts.appSlug, req.appSlug));
    }
    if (req.appSlug) {
      condition = eq(ctx.sql.tables.chatContexts.appSlug, req.appSlug);
    }
  }
  if (condition) {
    // console.log("openChat looking for Existing chat with condition", req);
    const rResult = await exception2Result(() =>
      ctx.sql.db
        .select()
        .from(ctx.sql.tables.chatContexts)
        .where(and(condition, eq(ctx.sql.tables.chatContexts.userId, req._auth.verifiedAuth.claims.userId)))
        .all()
    );
    if (rResult.isErr()) {
      return Result.Err(`Failed to query existing chat: ${rResult.Err().message}`);
    }
    const result = rResult.Ok();
    // console.log("openChat existing chat query result", result);
    if (result.length !== 1) {
      return Result.Err(`creation Chat ID ${req.chatId} not found`);
    }
    // if (result.userId !== req.auth.verifiedAuth.claims.userId) {
    // return Result.Err(`Chat ID ${req.chatId} does not belong to the user`);
    // }
    appSlug = result[0].appSlug;
    userSlug = result[0].userSlug;
    chatId = result[0].chatId;
  } else {
    const resUser = await ensureUserSlug(ctx, {
      userId: req._auth.verifiedAuth.claims.userId,
      userSlug: req.userSlug,
    });
    if (resUser.isErr()) {
      return Result.Err(`Failed to ensure userSlug: ${resUser.Err().message}`);
    }
    userSlug = resUser.Ok().userSlug;
    const resApp = await ensureAppSlug(ctx, {
      userId: req._auth.verifiedAuth.claims.userId,
      userSlug: userSlug,
      appSlug: req.appSlug,
    });
    if (resApp.isErr()) {
      return Result.Err(`Failed to ensure appSlug: ${resApp.Err().message}`);
    }
    appSlug = resApp.Ok().appSlug;
    if (!chatId) {
      chatId = ctx.sthis.nextId(12).str;
      await ctx.sql.db
        .insert(ctx.sql.tables.chatContexts)
        .values({
          chatId,
          userId: req._auth.verifiedAuth.claims.userId,
          appSlug,
          userSlug,
          created: new Date().toISOString(),
        })
        .run();
    }
  }
  return Result.Ok({ appSlug, userSlug, chatId });
}
