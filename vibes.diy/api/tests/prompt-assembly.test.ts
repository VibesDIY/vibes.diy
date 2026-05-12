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

  it("selected:{kind:'version',fsId} loads that fsId's vfs into SELECTED_VERSION slot", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    // Seed turn "fs-a": content "old"
    const rTurnA = await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [
        {
          type: "code-block",
          filename: "/App.jsx",
          lang: "jsx",
          content: "export default function App() { return <div>old</div>; } // version-a",
        },
      ],
      userMessage: "version a",
    });
    expect(rTurnA.isOk(), `appendTurnToChat(a) failed: ${rTurnA.isErr() ? String(rTurnA.Err()) : ""}`).toBe(true);
    const fsIdA = rTurnA.Ok().fsId;

    // Seed turn "fs-b": content "new" (distinct content => distinct fsId)
    const rTurnB = await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [
        {
          type: "code-block",
          filename: "/App.jsx",
          lang: "jsx",
          content: "export default function App() { return <div>new</div>; } // version-b",
        },
      ],
      userMessage: "version b",
    });
    expect(rTurnB.isOk(), `appendTurnToChat(b) failed: ${rTurnB.isErr() ? String(rTurnB.Err()) : ""}`).toBe(true);

    // Request with selected pointing at the older fsId
    const r = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "show me version a" }] }],
      selected: { kind: "version", fsId: fsIdA },
    });
    expect(r.isOk(), `assemblePromptPayload failed: ${r.isErr() ? String(r.Err()) : ""}`).toBe(true);
    const { messages } = r.Ok();
    const allText = messages.map(firstText).join("\n");

    expect(allText).toContain("SELECTED_VERSION");
    expect(allText).toContain("currently viewing this");

    await chat.close();
  });

  it("slots.compaction='off' disables turn compaction (older code blocks render verbatim)", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, userSlug);
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    // Seed a unique code-block body in turn 2 (an "older" turn relative to
    // turn 3). With compaction on, this body collapses to a "[Created … N
    // lines, B bytes]" summary; with compaction off, it must appear verbatim.
    const TURN2_MARKER = "compaction-off-verbatim-marker-7a3c";
    const TURN2_CONTENT = `export default function App() { return <div>${TURN2_MARKER}</div>; }`;

    await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      userSlug,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: TURN2_CONTENT }],
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

    const newUserMessages: ChatMessage[] = [{ role: "user", content: [{ type: "text", text: "next" }] }];

    const assistantText = (msgs: readonly ChatMessage[]): string =>
      msgs
        .filter((m) => m.role === "assistant")
        .map(firstText)
        .join("\n");

    const rOff = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages,
      slots: { compaction: "off" },
    });
    expect(rOff.isOk(), `compaction off failed: ${rOff.isErr() ? String(rOff.Err()) : ""}`).toBe(true);
    const offAssistant = assistantText(rOff.Ok().messages);

    const rOn = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages,
    });
    expect(rOn.isOk()).toBe(true);
    const onAssistant = assistantText(rOn.Ok().messages);

    // Compaction off: older assistant turn carries the code-block body verbatim.
    expect(offAssistant).toContain(TURN2_MARKER);
    // Compaction on (default): older assistant turn collapses to a summary
    // line and the unique body is absent from the assistant text.
    expect(onAssistant).not.toContain(TURN2_MARKER);
    expect(onAssistant).toContain("[Created /App.jsx");

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
    if (systemMsg === undefined) throw new Error("unreachable — assertion above failed");
    expect(firstText(systemMsg)).not.toContain("CURRENT FILES (resolved so far this turn):");

    await chat.close();
  });
});
