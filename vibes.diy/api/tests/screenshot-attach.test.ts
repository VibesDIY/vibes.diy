import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { uint8array2stream } from "@adviser/cement";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { assemblePromptPayload } from "@vibes.diy/api-svc";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";

const SCREENSHOT_SEQ_BASE = 1_701_300;

async function userIdForSlug(ctx: ApiTestCtx, ownerHandle: string): Promise<string> {
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ userId: ctx.appCtx.vibesCtx.sql.tables.handleBinding.userId })
    .from(ctx.appCtx.vibesCtx.sql.tables.handleBinding)
    .where(eq(ctx.appCtx.vibesCtx.sql.tables.handleBinding.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);
  if (row === undefined) throw new Error(`No handleBinding found for ownerHandle=${ownerHandle}`);
  return row.userId;
}

function lastUserMessage(messages: readonly ChatMessage[]): ChatMessage {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i];
  }
  throw new Error("no user message in payload");
}

function imageUrls(msg: ChatMessage): string[] {
  return msg.content.filter((c) => c.type === "image_url").map((c) => (c.type === "image_url" ? c.image_url.url : ""));
}

describe("assemblePromptPayload: screenshot attachment", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: SCREENSHOT_SEQ_BASE });
  });

  // Store screenshot bytes in asset storage and attach a screen-shot-ref to the
  // app's meta for the given fsId — mirrors what the queue's storeScreenshot does.
  async function seedScreenshot(fsId: string, bytes: Uint8Array): Promise<string> {
    const vctx = ctx.appCtx.vibesCtx;
    const [res] = await vctx.storage.ensure(uint8array2stream(bytes));
    expect(res?.isOk(), `storage.ensure failed: ${res?.isErr() ? String(res.Err()) : ""}`).toBe(true);
    const assetUrl = res.Ok().getURL;
    const row = await vctx.sql.db
      .select({ meta: vctx.sql.tables.apps.meta })
      .from(vctx.sql.tables.apps)
      .where(eq(vctx.sql.tables.apps.fsId, fsId))
      .limit(1)
      .then((r) => r[0]);
    const meta = Array.isArray(row?.meta) ? [...(row.meta as unknown[])] : [];
    meta.push({ type: "screen-shot-ref", mime: "image/jpeg", assetUrl });
    await vctx.sql.db.update(vctx.sql.tables.apps).set({ meta }).where(eq(vctx.sql.tables.apps.fsId, fsId));
    return assetUrl;
  }

  async function followUpChat(): Promise<{ chatId: string; fsId: string }> {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const rTurn = await appendTurnToChat(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default () => <div>v1</div>;" }],
      userMessage: "first prompt",
    });
    expect(rTurn.isOk(), `appendTurnToChat failed: ${rTurn.isErr() ? String(rTurn.Err()) : ""}`).toBe(true);
    return { chatId: chat.chatId, fsId: rTurn.Ok().fsId };
  }

  it("attaches the latest screenshot to the new user message on a follow-up when attachScreenshot is set", async () => {
    const { chatId, fsId } = await followUpChat();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
    await seedScreenshot(fsId, bytes);

    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "make the card smaller" }] }],
      attachScreenshot: true,
    });
    expect(r.isOk(), `assemble failed: ${r.isErr() ? String(r.Err()) : ""}`).toBe(true);

    const urls = imageUrls(lastUserMessage(r.Ok().messages));
    expect(urls.length).toBe(1);
    expect(urls[0].startsWith("data:image/jpeg;base64,")).toBe(true);
    // Round-trips back to the seeded bytes.
    const b64 = urls[0].slice("data:image/jpeg;base64,".length);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
    // The original text part is preserved alongside the image.
    expect(lastUserMessage(r.Ok().messages).content.some((c) => c.type === "text")).toBe(true);
  });

  it("does not attach a screenshot when attachScreenshot is omitted", async () => {
    const { chatId, fsId } = await followUpChat();
    await seedScreenshot(fsId, new Uint8Array([1, 2, 3, 4]));

    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "no image please" }] }],
    });
    expect(r.isOk()).toBe(true);
    expect(imageUrls(lastUserMessage(r.Ok().messages)).length).toBe(0);
  });

  it("is a no-op when no screenshot is stored (best-effort)", async () => {
    const { chatId } = await followUpChat();

    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "still works" }] }],
      attachScreenshot: true,
    });
    expect(r.isOk()).toBe(true);
    expect(imageUrls(lastUserMessage(r.Ok().messages)).length).toBe(0);
  });

  it("does not attach a screenshot on the initial (empty) turn even when requested", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "make a hello world app" }] }],
      attachScreenshot: true,
    });
    expect(r.isOk()).toBe(true);
    expect(imageUrls(lastUserMessage(r.Ok().messages)).length).toBe(0);
    await chat.close();
  });

  it("walks back to the most recent version that has a screenshot", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    const vctx = ctx.appCtx.vibesCtx;

    const rOld = await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default () => <div>old</div>;" }],
      userMessage: "old turn",
    });
    expect(rOld.isOk()).toBe(true);
    const oldFsId = rOld.Ok().fsId;

    // Newest turn has NO screenshot; only the older version does.
    await appendTurnToChat(vctx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [{ type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default () => <div>new</div>;" }],
      userMessage: "new turn",
    });

    const oldBytes = new Uint8Array([9, 8, 7, 6]);
    await seedScreenshot(oldFsId, oldBytes);

    const r = await assemblePromptPayload(vctx, {
      chatId: chat.chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: "tweak it" }] }],
      attachScreenshot: true,
    });
    expect(r.isOk()).toBe(true);
    const urls = imageUrls(lastUserMessage(r.Ok().messages));
    expect(urls.length).toBe(1);
    const b64 = urls[0].slice("data:image/jpeg;base64,".length);
    expect(Array.from(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).toEqual(Array.from(oldBytes));
    await chat.close();
  });
});
