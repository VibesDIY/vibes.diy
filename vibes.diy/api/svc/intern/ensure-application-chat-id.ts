import { and, eq } from "drizzle-orm/sql/expressions";
import { sqlApplicationChats, sqlAppSlugBinding } from "../sql/vibes-diy-api-schema.js";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { PromptAndBlockMsgs, ReqOpenChat } from "@vibes.diy/api-types";
import { ReqWithVerifiedAuth } from "../check-auth.js";
import { type } from "arktype";

interface EnsureChatIdPResult {
  chatId: string;
  blocks: PromptAndBlockMsgs[];
  created: Date;
  appSlug: string;
  userSlug: string;
}

export async function ensureApplicationChatId({
  ctx,
  req,
}: {
  ctx: VibesApiSQLCtx;
  req: ReqWithVerifiedAuth<ReqOpenChat>;
}): Promise<Result<EnsureChatIdPResult>> {
  const { chatId } = req;
  const appSlug = req.appSlug;
  const userSlug = req.userSlug;
  if (chatId) {
    const condition = [eq(sqlApplicationChats.userId, req.auth.verifiedAuth.claims.userId), eq(sqlApplicationChats.chatId, chatId)];
    const rResult = await exception2Result(() =>
      ctx.db
        .select()
        .from(sqlApplicationChats)
        .innerJoin(
          sqlAppSlugBinding,
          and(
            eq(sqlAppSlugBinding.appSlug, sqlApplicationChats.appSlug),
            eq(sqlAppSlugBinding.userSlug, sqlApplicationChats.userSlug)
          )
        )
        .where(and(...condition))
        .get()
    );
    if (rResult.isErr()) {
      return Result.Err(`Failed to query existing application chat: ${rResult.Err().message}`);
    }
    const result = rResult.Ok();
    if (!result) {
      return Result.Err("No existing application chat found");
    }
    const blocks = PromptAndBlockMsgs.array()(result.ApplicationChats.blocks);
    if (blocks instanceof type.errors) {
      return Result.Err(`Failed to parse blocks for existing application chat: ${blocks.summary}`);
    }
    return Result.Ok({
      appSlug: result.ApplicationChats.appSlug,
      userSlug: result.ApplicationChats.userSlug,
      chatId: result.ApplicationChats.chatId,
      blocks,
      created: new Date(result.ApplicationChats.created),
    });
  } else {
    if (!(appSlug && userSlug)) {
      return Result.Err("appSlug and userSlug are required if chatId is not provided");
    }
  }
  const rHasAppUserSlug = await exception2Result(() =>
    ctx.db
      .select()
      .from(sqlAppSlugBinding)
      .where(and(eq(sqlAppSlugBinding.appSlug, appSlug), eq(sqlAppSlugBinding.userSlug, userSlug)))
      .get()
  );
  if (rHasAppUserSlug.isErr()) {
    return Result.Err(`Failed to query app slug binding: ${rHasAppUserSlug.Err().message}`);
  }
  if (!rHasAppUserSlug.Ok()) {
    return Result.Err(`No app slug binding found for appSlug ${appSlug} and userSlug ${userSlug}`);
  }
  const newChatId = ctx.sthis.nextId(12).str;
  const created = new Date();
  const value = {
    userId: req.auth.verifiedAuth.claims.userId,
    appSlug,
    userSlug,
    chatId: newChatId,
    blocks: [],
    created: created.toISOString(),
  };
  const rInsert = await exception2Result(async () => ctx.db.insert(sqlApplicationChats).values(value));
  if (rInsert.isErr()) {
    return Result.Err(`Error Creating new app: ${rInsert.Err().message}`);
  }
  return Result.Ok({
    appSlug,
    userSlug,
    chatId: newChatId,
    blocks: [],
    created: created,
  });
}
