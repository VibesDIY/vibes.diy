import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { exception2Result } from "@adviser/cement";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";
import { loadVersionTimeline, selectSlotSources, loadLatestPromptId } from "../svc/intern/version-timeline.js";
import type { PromptContextSql } from "@vibes.diy/call-ai-v2";

const SEQ_BASE = 1_667_300;

/**
 * Look up the userId that owns a given userSlug.  Mirrors the same helper
 * used in append-turn-to-chat.test.ts.
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

describe("loadVersionTimeline", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: SEQ_BASE });
  });

  it("returns exactly the seed entry for a chat with only the initial push turn", async () => {
    // createApp() calls ensureAppSlug → ensurePushSeededChat, which inserts one
    // promptContexts row as the seed for the app.  openChat resolves to that same
    // chatId, so a fresh timeline is never empty — it always contains the seed entry.
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    const chat = rOpen.Ok();

    const tl = (await loadVersionTimeline(ctx.appCtx.vibesCtx, chat.chatId)).Ok();
    // Exactly one entry: the seed row from the initial push.
    expect(tl).toHaveLength(1);
    expect(typeof tl[0].fsId).toBe("string");
    expect(tl[0].created).toBeInstanceOf(Date);
    expect(tl[0].vfs).toBeInstanceOf(Map);
    // Seed content from createApp: function App() { return <div>Hello …</div>; } App();
    // The filename used in createApp is "/App.jsx" (with leading slash) → stored as-is.
    expect(tl[0].vfs.has("/App.jsx")).toBe(true);
    expect(typeof tl[0].vfs.get("/App.jsx")).toBe("string");

    await chat.close();
  });

  it("returns distinct fsIds oldest-first for seed + two appended turns", async () => {
    // createApp inserts a seed row (fsId = seedFsId) with /App.jsx.
    // We then append two more turns; the timeline has 3 entries: seed, r1, r2.
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);

    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    // Valid JSX content required: transformJSXToJS runs during ensureApps and
    // silently drops files whose content cannot be parsed.  "v1" / "v2" are not
    // valid JS so they would be dropped from Apps.fileSystem and never reach
    // storage-fetch.  Use minimal valid JSX function bodies instead.
    const V1_CONTENT = "export default function App() { return null; } // v1";
    const V2_CONTENT = "export default function App() { return null; } // v2";

    const r1 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V1_CONTENT }],
      })
    ).Ok();

    const r2 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V2_CONTENT }],
      })
    ).Ok();

    const tl = (await loadVersionTimeline(vctx, chat.chatId)).Ok();

    // Three entries: seed + r1 + r2, oldest first.
    expect(tl).toHaveLength(3);
    const fsIds = tl.map((v) => v.fsId);
    // The last two are the explicitly appended turns.
    expect(fsIds[1]).toBe(r1.fsId);
    expect(fsIds[2]).toBe(r2.fsId);

    // Each entry exposes a vfs map with a Date.
    for (const entry of tl) {
      expect(entry.vfs).toBeInstanceOf(Map);
      expect(entry.created).toBeInstanceOf(Date);
    }

    // r1 and r2 must have actual content resolved from storage.
    // filename "/App.jsx" (already has leading slash) → stored as-is as the vfs key.
    expect(tl[1].vfs.get("/App.jsx")).toBe(V1_CONTENT);
    expect(tl[2].vfs.get("/App.jsx")).toBe(V2_CONTENT);

    await chat.close();
  });

  it("dedups two PromptContexts rows sharing the same fsId into one timeline entry", async () => {
    // createApp inserts a seed promptContexts row (seedFsId).
    // We then append one turn (r1.fsId) and directly insert a second
    // promptContexts row with the same r1.fsId.  The timeline should dedup
    // the duplicate and return 2 entries: [seed, r1].
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);

    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const DEDUP_CONTENT = "export default function App() { return null; } // dedup-v1";

    const r1 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: DEDUP_CONTENT }],
      })
    ).Ok();

    const sharedFsId = r1.fsId;
    const now = new Date();

    // Directly insert a second PromptContexts row pointing to the same fsId.
    // This simulates a turn that produced no file change (same fsId re-used).
    const refValue: PromptContextSql = {
      type: "prompt.usage.sql",
      usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
      fsRef: { fsId: sharedFsId, mode: "dev", appSlug, userSlug },
    };
    const rInsert = await exception2Result(() =>
      vctx.sql.db.insert(vctx.sql.tables.promptContexts).values({
        userId,
        chatId: chat.chatId,
        promptId: vctx.sthis.nextId(12).str,
        fsId: sharedFsId,
        nethash: vctx.netHash(),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        ref: refValue,
        created: new Date(now.getTime() + 1000).toISOString(),
      })
    );
    expect(rInsert.isOk(), `direct insert failed: ${rInsert.isErr() ? rInsert.Err() : ""}`).toBe(true);

    const tl = (await loadVersionTimeline(vctx, chat.chatId)).Ok();

    // 3 DB rows (seed, r1-first, r1-duplicate) → 2 deduplicated timeline entries.
    expect(tl).toHaveLength(2);

    // Last entry is r1's fsId (the deduplicated one)
    expect(tl[1].fsId).toBe(sharedFsId);

    // Content must be resolvable from storage.
    expect(tl[1].vfs.get("/App.jsx")).toBe(DEDUP_CONTENT);

    await chat.close();
  });

  it("loadLatestPromptId returns undefined for a chat with no turns", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const _userId = await userIdForSlug(ctx, userSlug);

    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    // Delete all promptContexts rows for this chat (including the seed)
    await exception2Result(() =>
      vctx.sql.db.delete(vctx.sql.tables.promptContexts).where(eq(vctx.sql.tables.promptContexts.chatId, chat.chatId))
    );

    const r = await loadLatestPromptId(vctx, chat.chatId);
    expect(r.isOk()).toBe(true);
    expect(r.Ok()).toBeUndefined();

    await chat.close();
  });

  it("loadLatestPromptId returns the promptId of the most recent turn", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);

    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const V1_CONTENT = "export default function App() { return null; } // v1";
    const V2_CONTENT = "export default function App() { return null; } // v2";

    const _r1 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V1_CONTENT }],
      })
    ).Ok();

    const r2 = (
      await appendTurnToChat(vctx, {
        chatId: chat.chatId,
        userId,
        userSlug,
        appSlug,
        fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V2_CONTENT }],
      })
    ).Ok();

    const result = await loadLatestPromptId(vctx, chat.chatId);
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBe(r2.promptId);

    await chat.close();
  });
});

describe("selectSlotSources", () => {
  const v = (fsId: string, file: string) => ({
    fsId,
    created: new Date(),
    vfs: new Map<string, string>([["/App.jsx", file]]),
  });

  it("empty timeline: all slots undefined", () => {
    const s = selectSlotSources([]);
    expect(s.original).toBeUndefined();
    expect(s.previous).toBeUndefined();
    expect(s.prev2).toBeUndefined();
  });

  it("one version: original == previous, prev2 absent", () => {
    const s = selectSlotSources([v("a", "v1")]);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("a");
    expect(s.prev2).toBeUndefined();
  });

  it("two versions: original=v1, previous=v2, prev2=v1", () => {
    const s = selectSlotSources([v("a", "v1"), v("b", "v2")]);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("b");
    expect(s.prev2?.fsId).toBe("a");
  });

  it("three+ versions: prev2 is the one immediately before previous", () => {
    const s = selectSlotSources([v("a", "v1"), v("b", "v2"), v("c", "v3")]);
    expect(s.original?.fsId).toBe("a");
    expect(s.previous?.fsId).toBe("c");
    expect(s.prev2?.fsId).toBe("b");
  });
});
