import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { assemblePromptPayload } from "@vibes.diy/api-svc";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

async function userIdForSlug(ctx: ApiTestCtx, userSlug: string): Promise<string> {
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ userId: ctx.appCtx.vibesCtx.sql.tables.userSlugBinding.userId })
    .from(ctx.appCtx.vibesCtx.sql.tables.userSlugBinding)
    .where(eq(ctx.appCtx.vibesCtx.sql.tables.userSlugBinding.userSlug, userSlug))
    .limit(1)
    .then((r) => r[0]);
  if (row === undefined) throw new Error(`No userSlugBinding found for userSlug=${userSlug}`);
  return row.userId;
}

const SLOT_SEQ_BASE = 1_667_400;

const V1_CONTENT = "export default function App() { return <div>v1</div>; } // original";
const V2_CONTENT = "export default function App() { return <div>v2</div>; } // prev2";
const V3_CONTENT = "export default function App() { return <div>v3</div>; } // previous";

describe("assemblePromptPayload: slot interpolation", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: SLOT_SEQ_BASE });
  });

  it("on a 3-turn chat, payload contains synthetic ORIGINAL + LAST_EDIT + PREVIOUS user messages", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    // The seed from createApp() is turn 0 (original). Append two more turns.
    await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V2_CONTENT }],
      userMessage: "turn 2",
    });

    await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: V3_CONTENT }],
      userMessage: "turn 3",
    });

    const r = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "next" }] }],
    });
    expect(r.isOk(), `assemblePromptPayload failed: ${r.isErr() ? String(r.Err()) : ""}`).toBe(true);
    const { messages } = r.Ok();

    // Collect all message texts
    const allText = messages.map(firstText).join("\n");

    // Slot messages should contain ORIGINAL, LAST_EDIT, and PREVIOUS labels
    expect(allText).toContain("ORIGINAL");
    expect(allText).toContain("LAST_EDIT");
    expect(allText).toContain("PREVIOUS");

    // The final user message should be the "next" prompt
    expect(firstText(messages[messages.length - 1])).toBe("next");

    await chat.close();
  });

  it("system prompt no longer contains 'CURRENT FILES (resolved so far this turn):'", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const r = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    });
    expect(r.isOk()).toBe(true);
    const { messages } = r.Ok();

    const systemMsg = messages.find((m) => m.role === "system");
    expect(systemMsg).toBeDefined();
    expect(firstText(systemMsg!)).not.toContain("CURRENT FILES (resolved so far this turn):");

    await chat.close();
  });
});
