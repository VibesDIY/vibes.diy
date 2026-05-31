import { beforeAll, describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { assemblePromptPayload } from "@vibes.diy/api-svc";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

const ASSEMBLE_SEQ_BASE = 1_696_100;

describe("assemblePromptPayload", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: ASSEMBLE_SEQ_BASE });
  });

  it("returns system + new user turn for an initial (empty) chat", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "make a hello world app" }] }],
    });
    expect(r.isOk()).toBe(true);
    const { model, messages } = r.Ok();
    expect(model).toBe("anthropic/claude-sonnet-4-6");
    expect(messages[0].role).toBe("system");
    expect(messages[messages.length - 1].role).toBe("user");
    expect(firstText(messages[messages.length - 1])).toBe("make a hello world app");
    await chat.close();
  });

  it("produces deterministic output for the same inputs (idempotent reads)", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const userMsg: ChatMessage = { role: "user", content: [{ type: "text", text: "first prompt" }] };

    const r1 = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [userMsg],
    });
    const r2 = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [userMsg],
    });
    expect(r1.isOk()).toBe(true);
    expect(r2.isOk()).toBe(true);
    expect(JSON.stringify(r1.Ok())).toBe(JSON.stringify(r2.Ok()));
    await chat.close();
  });
});
