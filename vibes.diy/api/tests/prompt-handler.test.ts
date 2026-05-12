import { beforeAll, describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

function allTexts(messages: readonly ChatMessage[]): string[] {
  return messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
}

const HANDLER_SEQ_BASE = 1_667_160;

describe("promptChatSection handler with selected+slots", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: HANDLER_SEQ_BASE });
  });

  it("dryRun with selected:{kind:draft,files} renders SELECTED_DRAFT as canonical", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const payload = await ctx.dryRun({
      chatId: chat.chatId,
      promptText: "make it pink",
      selected: {
        kind: "draft",
        files: [
          {
            type: "code-block",
            filename: "/App.jsx",
            lang: "jsx",
            content: "on-disk content",
          },
        ],
      },
    });

    const texts = allTexts(payload.messages);
    expect(texts.some((t) => t.includes("SELECTED_DRAFT"))).toBe(true);
    expect(texts.some((t) => t.includes("on-disk content"))).toBe(true);

    await chat.close();
  });

  it("dryRun without selected does not render SELECTED_DRAFT", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const payload = await ctx.dryRun({
      chatId: chat.chatId,
      promptText: "make it blue",
    });

    const texts = allTexts(payload.messages);
    expect(texts.some((t) => t.includes("SELECTED_DRAFT"))).toBe(false);

    await chat.close();
  });
});
