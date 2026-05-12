import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";

const SEQ_BASE = 1_667_100;

/**
 * Look up the userId that owns a given userSlug. After createApp() the
 * userSlugBinding row is guaranteed to exist; this avoids the need to expose
 * userId through the public API surface.
 */
async function userIdForSlug(ctx: ApiTestCtx, userSlug: string): Promise<string> {
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ userId: ctx.appCtx.vibesCtx.sql.tables.userSlugBinding.userId })
    .from(ctx.appCtx.vibesCtx.sql.tables.userSlugBinding)
    .where(eq(ctx.appCtx.vibesCtx.sql.tables.userSlugBinding.userSlug, userSlug))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new Error(`No userSlugBinding found for userSlug=${userSlug}`);
  return row.userId;
}

describe("appendTurnToChat", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: SEQ_BASE });
  });

  it("appends a PromptContexts row + ChatSections row + Apps row in one call", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);

    const r1 = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(r1.isOk()).toBe(true);
    const chat = r1.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const before = {
      prompt: (
        await vctx.sql.db
          .select()
          .from(vctx.sql.tables.promptContexts)
          .where(eq(vctx.sql.tables.promptContexts.chatId, chat.chatId))
      ).length,
      section: (
        await vctx.sql.db.select().from(vctx.sql.tables.chatSections).where(eq(vctx.sql.tables.chatSections.chatId, chat.chatId))
      ).length,
    };

    const result = await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "App.jsx", lang: "jsx", content: "export default () => <h1>v1</h1>" }],
      userMessage: "make it",
    });

    expect(result.isOk(), `appendTurnToChat failed: ${result.isErr() ? result.Err() : ""}`).toBe(true);
    const { promptId, fsId } = result.Ok();
    expect(typeof promptId).toBe("string");
    expect(typeof fsId).toBe("string");
    expect(promptId.length).toBeGreaterThan(0);
    expect(fsId.length).toBeGreaterThan(0);

    const after = {
      prompt: (
        await vctx.sql.db
          .select()
          .from(vctx.sql.tables.promptContexts)
          .where(eq(vctx.sql.tables.promptContexts.chatId, chat.chatId))
      ).length,
      section: (
        await vctx.sql.db.select().from(vctx.sql.tables.chatSections).where(eq(vctx.sql.tables.chatSections.chatId, chat.chatId))
      ).length,
    };

    expect(after.prompt).toBe(before.prompt + 1);
    expect(after.section).toBe(before.section + 1);
    await chat.close();
  });

  it("appending two turns produces two distinct PromptContexts rows with different fsIds and promptIds", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);

    const r1 = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(r1.isOk()).toBe(true);
    const chat = r1.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const t1 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "App.jsx", lang: "jsx", content: "export default () => <h1>v1</h1>" }],
      })
    ).Ok();

    const t2 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "App.jsx", lang: "jsx", content: "export default () => <h1>v2</h1>" }],
      })
    ).Ok();

    expect(t1.fsId).not.toBe(t2.fsId);
    expect(t1.promptId).not.toBe(t2.promptId);

    const rows = await vctx.sql.db
      .select({ fsId: vctx.sql.tables.promptContexts.fsId, promptId: vctx.sql.tables.promptContexts.promptId })
      .from(vctx.sql.tables.promptContexts)
      .where(eq(vctx.sql.tables.promptContexts.chatId, chat.chatId));

    const fsIds = rows.map((r) => r.fsId).filter(Boolean);
    expect(fsIds).toContain(t1.fsId);
    expect(fsIds).toContain(t2.fsId);

    await chat.close();
  });
});
