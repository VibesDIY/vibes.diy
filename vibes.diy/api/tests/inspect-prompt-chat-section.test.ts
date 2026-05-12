import { beforeAll, describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { eq } from "drizzle-orm";
import {
  isResError,
  isResInspectPromptChatSection,
  type ResInspectPromptChatSection,
  type ReqInspectPromptChatSection,
} from "@vibes.diy/api-types";
import type { Req } from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

const INSPECT_SEQ_BASE = 1_696_200;

describe("inspectPromptChatSection", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: INSPECT_SEQ_BASE });
  });

  it("returns model+messages without writing to PromptContexts or ChatSections", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const db = ctx.appCtx.vibesCtx.sql.db;
    const tables = ctx.appCtx.vibesCtx.sql.tables;
    const before = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };

    const rInspect = await ctx.api.request<Req<ReqInspectPromptChatSection> & { type: string }, ResInspectPromptChatSection>(
      {
        type: "vibes.diy.req-inspect-prompt-chat-section",
        chatId: chat.chatId,
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "preview this please" }] }] },
      },
      { resMatch: isResInspectPromptChatSection }
    );
    expect(rInspect.isOk()).toBe(true);
    const res = rInspect.Ok();
    expect(res.chatId).toBe(chat.chatId);
    expect(res.messages[0].role).toBe("system");
    expect(res.messages[res.messages.length - 1].role).toBe("user");
    expect(firstText(res.messages[res.messages.length - 1])).toBe("preview this please");

    const after = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };
    expect(after).toEqual(before);
    await chat.close();
  });

  it("returns an error for a chat the caller does not own", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ userSlug, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    await chat.close();

    const rInspect = await ctx.api2.request<Req<ReqInspectPromptChatSection> & { type: string }, ResInspectPromptChatSection>(
      {
        type: "vibes.diy.req-inspect-prompt-chat-section",
        chatId: chat.chatId,
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "spy" }] }] },
      },
      { resMatch: (m: unknown) => isResInspectPromptChatSection(m) || isResError(m) }
    );
    expect(rInspect.isOk()).toBe(false);
  });
});
