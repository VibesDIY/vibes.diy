import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { ensureUserSlug, ensureAppSlug, getDefaultUserSlug, persistDefaultUserSlug } from "./ensure-slug-binding.js";
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
  let appSlug = "";
  let userSlug = "";
  let chatId: string | undefined;
  const userId = req._auth.verifiedAuth.claims.userId;

  if (req.chatId) {
    const reqChatId = req.chatId;
    const rResult = await exception2Result(() =>
      ctx.sql.db
        .select()
        .from(ctx.sql.tables.chatContexts)
        .where(and(eq(ctx.sql.tables.chatContexts.chatId, reqChatId), eq(ctx.sql.tables.chatContexts.userId, userId)))
    );
    if (rResult.isErr()) {
      return Result.Err(`Failed to query existing chat: ${rResult.Err().message}`);
    }
    const result = rResult.Ok();
    if (result.length !== 1) {
      return Result.Err(`Chat ID ${req.chatId} not found`);
    }
    appSlug = result[0].appSlug;
    userSlug = result[0].userSlug;
    chatId = result[0].chatId;
  } else {
    // Resolve userSlug: explicit → default → create new
    if (req.userSlug) {
      const resUser = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId, userSlug: req.userSlug });
      if (resUser.isErr()) return Result.Err(`Failed to ensure userSlug: ${resUser.Err().message}`);
      userSlug = resUser.Ok().userSlug;
    } else {
      const resDefault = await getDefaultUserSlug(ctx, userId);
      if (resDefault.isErr()) return Result.Err(`Failed to get default userSlug: ${resDefault.Err().message}`);
      const defaultBinding = resDefault.Ok();
      if (defaultBinding) {
        userSlug = defaultBinding.userSlug;
      } else {
        const resNew = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId });
        if (resNew.isErr()) return Result.Err(`Failed to ensure userSlug: ${resNew.Err().message}`);
        userSlug = resNew.Ok().userSlug;
        await persistDefaultUserSlug(ctx, userId, userSlug);
      }
    }

    // Look up existing chat by userSlug+appSlug if appSlug provided
    if (req.appSlug) {
      const reqAppSlug = req.appSlug;
      const rResult = await exception2Result(() =>
        ctx.sql.db
          .select()
          .from(ctx.sql.tables.chatContexts)
          .where(
            and(
              eq(ctx.sql.tables.chatContexts.userId, userId),
              eq(ctx.sql.tables.chatContexts.userSlug, userSlug),
              eq(ctx.sql.tables.chatContexts.appSlug, reqAppSlug)
            )
          )
      );
      if (rResult.isOk() && rResult.Ok().length === 1) {
        const existing = rResult.Ok()[0];
        appSlug = existing.appSlug;
        chatId = existing.chatId;
      }
    }

    if (!chatId) {
      const resApp = await ensureAppSlug(ctx, { userId, userSlug, appSlug: req.appSlug });
      if (resApp.isErr()) {
        return Result.Err(`Failed to ensure appSlug: ${resApp.Err().message}`);
      }
      appSlug = resApp.Ok().appSlug;
      chatId = ctx.sthis.nextId(12).str;
      await ctx.sql.db.insert(ctx.sql.tables.chatContexts).values({
        chatId,
        userId,
        appSlug,
        userSlug,
        created: new Date().toISOString(),
      });
    }
  }
  return Result.Ok({ appSlug, userSlug, chatId });
}
