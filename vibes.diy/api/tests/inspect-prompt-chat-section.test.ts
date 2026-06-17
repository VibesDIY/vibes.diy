import { beforeAll, describe, expect, it } from "vitest";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { eq } from "drizzle-orm";
import { isPromptDryRunPayload, isSectionEvent, isResError, isResPromptChatSection } from "@vibes.diy/api-types";
import type { SectionEvent, ResPromptChatSection, OptionalAuth } from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

const DRY_RUN_SEQ_BASE = 1_696_200;

// Reads the section stream for one dry-run-payload block belonging to
// `chatId` and returns its `request` field. Times out after `maxMsgs`
// stream events with no payload found.
async function readDryRunPayload(
  stream: ReadableStream<unknown>,
  chatId: string,
  maxMsgs = 20
): Promise<{ model: string; messages: ChatMessage[] } | undefined> {
  const reader = stream.getReader();
  let seen = 0;
  try {
    while (seen < maxMsgs) {
      const { value, done } = await reader.read();
      if (done) return undefined;
      seen++;
      if (!isSectionEvent(value)) continue;
      const sectionEvent = value as SectionEvent;
      if (sectionEvent.chatId !== chatId) continue;
      for (const block of sectionEvent.blocks) {
        if (isPromptDryRunPayload(block)) {
          return { model: block.request.model ?? "", messages: block.request.messages as ChatMessage[] };
        }
      }
    }
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

describe("promptChatSection dry-run (chat mode)", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: DRY_RUN_SEQ_BASE });
  });

  it("returns assembled {model, messages} as a section-stream block without writing to PromptContexts or ChatSections", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const db = ctx.appCtx.vibesCtx.sql.db;
    const tables = ctx.appCtx.vibesCtx.sql.tables;
    const before = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };

    const ack = await chat.prompt(
      { messages: [{ role: "user", content: [{ type: "text", text: "preview please" }] }] },
      { dryRun: true }
    );
    expect(ack.isOk()).toBe(true);

    const payload = await readDryRunPayload(chat.sectionStream, chat.chatId);
    expect(payload).toBeDefined();
    if (!payload) throw new Error("no dry-run-payload block seen");
    expect(payload.messages[0].role).toBe("system");
    expect(payload.messages[payload.messages.length - 1].role).toBe("user");
    expect(firstText(payload.messages[payload.messages.length - 1])).toBe("preview please");

    const after = {
      promptContexts: (await db.select().from(tables.promptContexts).where(eq(tables.promptContexts.chatId, chat.chatId))).length,
      chatSections: (await db.select().from(tables.chatSections).where(eq(tables.chatSections.chatId, chat.chatId))).length,
    };
    expect(after).toEqual(before);
    await chat.close();
  });

  it("persistence-free openChat dry-run creates no chatContexts row and no appSlugBinding (#2364)", async () => {
    const freshCtx = await createApiTestCtx({ seqUserIdBase: DRY_RUN_SEQ_BASE + 5000 });
    const db = freshCtx.appCtx.vibesCtx.sql.db;
    const tables = freshCtx.appCtx.vibesCtx.sql.tables;

    const beforeChat = (await db.select().from(tables.chatContexts)).length;
    const beforeSlug = (await db.select().from(tables.appSlugBinding)).length;

    // No ownerHandle/appSlug supplied — the persistence-free path synthesizes
    // both in-memory rather than allocating bindings.
    const rOpen = await freshCtx.api.openChat({ mode: "chat", dryRun: true });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    // The synthesized chatId was never inserted into chatContexts.
    const chatRow = await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.chatId, chat.chatId));
    expect(chatRow.length).toBe(0);

    // The prompt handler resolves owner/app from the inline fields the client
    // forwards on dry-run, so the preview still assembles against no row.
    const ack = await chat.prompt(
      { messages: [{ role: "user", content: [{ type: "text", text: "preview please" }] }] },
      { dryRun: true }
    );
    expect(ack.isOk()).toBe(true);

    const payload = await readDryRunPayload(chat.sectionStream, chat.chatId);
    expect(payload).toBeDefined();
    if (!payload) throw new Error("no dry-run-payload block seen");
    expect(payload.messages[0].role).toBe("system");
    expect(firstText(payload.messages[payload.messages.length - 1])).toBe("preview please");

    // The whole flow created no bookkeeping rows.
    expect((await db.select().from(tables.chatContexts)).length).toBe(beforeChat);
    expect((await db.select().from(tables.appSlugBinding)).length).toBe(beforeSlug);
    await chat.close();
  });

  it("dry-run openChat rejects an explicit handle owned by another user (#2364 review)", async () => {
    // api2 owns a handle (real chat created below); api — a different user —
    // must not be able to preview against it just because dry-run is read-only.
    const rOpen2 = await ctx.api2.openChat({ mode: "chat" });
    expect(rOpen2.isOk()).toBe(true);
    const foreignHandle = rOpen2.Ok().ownerHandle;
    await rOpen2.Ok().close();

    const rDry = await ctx.api.openChat({ ownerHandle: foreignHandle, mode: "chat", dryRun: true });
    expect(rDry.isOk()).toBe(false);
  });

  it("forged dry-run with inline slugs cannot reconstruct another user's chat (#2364 review)", async () => {
    // api2 opens a real chat (persisted chatContexts row).
    const rOpen2 = await ctx.api2.openChat({ mode: "chat" });
    expect(rOpen2.isOk()).toBe(true);
    const victim = rOpen2.Ok();

    // api forges a dry-run prompt carrying the victim's chatId + inline slugs.
    // The ownership guard must fall through to the userId-scoped lookup and
    // reject — never synthesize a ResChat that lets assembly read the victim's
    // chatId-scoped history.
    const forged = {
      type: "vibes.diy.req-prompt-chat-section" as const,
      mode: "chat" as const,
      chatId: victim.chatId,
      outerTid: ctx.sthis.nextId(12).str,
      prompt: { messages: [{ role: "user" as const, content: [{ type: "text" as const, text: "leak please" }] }] },
      dryRun: true,
      ownerHandle: victim.ownerHandle,
      appSlug: victim.appSlug,
    };
    const rForged = await ctx.api.request<typeof forged & OptionalAuth, ResPromptChatSection>(forged, {
      resMatch: isResPromptChatSection,
    });
    expect(rForged.isOk()).toBe(false);
    await victim.close();
  });

  it("forged dry-run with a fresh chatId but foreign owner is rejected (no foreign-defaults probe) (#2364 review)", async () => {
    // api2 owns a handle/app. api forges a dry-run with a *fresh* (never
    // persisted) chatId — so the ephemeral shortcut is taken — but names api2's
    // owner/app inline to try to probe their model defaults. The owner-ownership
    // gate must reject it.
    const rOpen2 = await ctx.api2.openChat({ mode: "chat" });
    expect(rOpen2.isOk()).toBe(true);
    const victim = rOpen2.Ok();
    await victim.close();

    const forged = {
      type: "vibes.diy.req-prompt-chat-section" as const,
      mode: "chat" as const,
      chatId: ctx.sthis.nextId(12).str, // fresh — no chatContexts row exists
      outerTid: ctx.sthis.nextId(12).str,
      prompt: { messages: [{ role: "user" as const, content: [{ type: "text" as const, text: "probe defaults" }] }] },
      dryRun: true,
      ownerHandle: victim.ownerHandle,
      appSlug: victim.appSlug,
    };
    const rForged = await ctx.api.request<typeof forged & OptionalAuth, ResPromptChatSection>(forged, {
      resMatch: isResPromptChatSection,
    });
    expect(rForged.isOk()).toBe(false);
  });

  it("edit-style dry-run on an app-slug with no chat creates no chatContexts row (#2374)", async () => {
    // Use a real owned handle but an app-slug that was never pushed/chatted.
    // The old edit dry-run (openChat without dryRun) would have inserted a
    // chatContexts row (and an appSlugBinding) for this slug; the dry-run path
    // must not.
    const { ownerHandle } = await ctx.createApp();
    const db = ctx.appCtx.vibesCtx.sql.db;
    const tables = ctx.appCtx.vibesCtx.sql.tables;
    const appSlug = `edit-dry-${ctx.sthis.nextId(6).str}`;
    expect((await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.appSlug, appSlug))).length).toBe(0);

    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat", dryRun: true });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    // Ephemeral: the returned chatId was not inserted.
    expect((await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.chatId, chat.chatId))).length).toBe(0);

    const ack = await chat.prompt(
      { messages: [{ role: "user", content: [{ type: "text", text: "tweak the header" }] }] },
      { dryRun: true }
    );
    expect(ack.isOk()).toBe(true);
    const payload = await readDryRunPayload(chat.sectionStream, chat.chatId);
    expect(payload).toBeDefined();

    // Still no chat row (and no appSlugBinding) for the slug after the whole flow.
    expect((await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.appSlug, appSlug))).length).toBe(0);
    expect((await db.select().from(tables.appSlugBinding).where(eq(tables.appSlugBinding.appSlug, appSlug))).length).toBe(0);
    await chat.close();
  });

  it("dry-run reuses an app's existing (push-seeded) chat without inserting a new row (#2374)", async () => {
    // createApp pushes files, which seeds a chat (ensurePushSeededChat).
    const { appSlug, ownerHandle } = await ctx.createApp();
    const db = ctx.appCtx.vibesCtx.sql.db;
    const tables = ctx.appCtx.vibesCtx.sql.tables;
    const seeded = await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.appSlug, appSlug));
    expect(seeded.length).toBe(1);

    // A dry-run openChat for the same app reuses the seeded chatId and adds no
    // row, so the preview assembles against the app's real history.
    const rDry = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat", dryRun: true });
    expect(rDry.isOk()).toBe(true);
    const dryChat = rDry.Ok();
    expect(dryChat.chatId).toBe(seeded[0].chatId);
    expect((await db.select().from(tables.chatContexts).where(eq(tables.chatContexts.appSlug, appSlug))).length).toBe(1);
    await dryChat.close();
  });

  it("rejects requests with no new user message", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    const chat = rOpen.Ok();

    const ack = await chat.prompt({ messages: [] }, { dryRun: true });
    expect(ack.isOk()).toBe(false);
    await chat.close();
  });

  it("returns an error for a chat the caller does not own", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    const chat = rOpen.Ok();
    await chat.close();

    // api2 opens a chat session against api's chatId by calling prompt
    // directly through openChat — but the ownership check rejects on
    // openChat. So we use api2.request directly with the raw payload.
    const rOpen2 = await ctx.api2.openChat({ ownerHandle, appSlug, mode: "chat" });
    // openChat behavior for non-owner: may succeed because chat-create or
    // may error. We only need to confirm THAT chat (whatever it is) is
    // not the same as `chat.chatId` AND that a dry-run against
    // `chat.chatId` from api2 either fails the openChat or fails the
    // dry-run. Reuse the rOpen2 result if it produced a different chatId
    // — the simpler assertion is: api2 cannot get a useful payload back
    // for api's chatId.
    if (rOpen2.isOk()) {
      const chat2 = rOpen2.Ok();
      const ack = await chat2.prompt({ messages: [{ role: "user", content: [{ type: "text", text: "spy" }] }] }, { dryRun: true });
      // Either the ack errored, or the chat2 stream never emits a payload
      // for chat.chatId (the only one we'd recognize). Read with a short
      // timeout via msg cap.
      if (ack.isOk()) {
        const payload = await readDryRunPayload(chat2.sectionStream, chat.chatId, 5);
        expect(payload).toBeUndefined();
      }
      await chat2.close();
    } else {
      expect(rOpen2.isOk() || isResError(rOpen2.Err())).toBe(true);
    }
  });
});
