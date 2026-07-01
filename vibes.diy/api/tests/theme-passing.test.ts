import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { assemblePromptPayload, persistCodegenThemeMarker } from "@vibes.diy/api-svc";
import { isActiveCodegenTheme, parseArrayWarning, ActiveEntry } from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";

const THEME_SEQ_BASE = 1_696_400;

// The theme design guidance is wrapped in <theme-design-md> by makeBaseSystemPrompt.
function systemHasThemeDesign(messages: ChatMessage[]): boolean {
  const sys = messages.find((m) => m.role === "system");
  const text = sys?.content.map((c) => (c.type === "text" ? c.text : "")).join("") ?? "";
  return text.includes("<theme-design-md>");
}

async function userIdForHandle(ctx: ApiTestCtx, ownerHandle: string): Promise<string> {
  const t = ctx.appCtx.vibesCtx.sql.tables.handleBinding;
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ userId: t.userId })
    .from(t)
    .where(eq(t.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);
  if (!row) throw new Error(`no handleBinding for ${ownerHandle}`);
  return row.userId;
}

async function readMarker(ctx: ApiTestCtx, ownerHandle: string, appSlug: string): Promise<string | undefined> {
  const t = ctx.appCtx.vibesCtx.sql.tables.appSettings;
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ settings: t.settings })
    .from(t)
    .where(eq(t.appSlug, appSlug))
    .limit(1)
    .then((r) => r[0]);
  const { filtered } = parseArrayWarning((row?.settings ?? []) as ActiveEntry[], ActiveEntry);
  return filtered.findLast(isActiveCodegenTheme)?.theme;
}

async function assemble(ctx: ApiTestCtx, chatId: string): Promise<ChatMessage[]> {
  const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
    chatId,
    model: "anthropic/claude-sonnet-4-6",
    newUserMessages: [{ role: "user", content: [{ type: "text", text: "tweak the layout" }] }],
  });
  if (r.isOk() === false) throw new Error(`assemble failed: ${String(r.Err())}`);
  return r.Ok().messages;
}

describe("theme passing: initial-or-theme-changed gating", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: THEME_SEQ_BASE });
  });

  it("includes the theme design block on the initial turn", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });

    expect(systemHasThemeDesign(await assemble(ctx, chat.chatId))).toBe(true);
    await chat.close();
  });

  it("omits the theme design block on a follow-up when the theme is unchanged", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });

    // Simulate a completed first turn: append a turn (non-empty timeline) and
    // record the theme codegen was built against — exactly what a real turn does.
    await appendTurnToChat(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [
        { type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default function App(){return null;}" },
      ],
      userMessage: "first turn",
      promptId: "t1",
    });
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug });
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBe("atlas");

    expect(systemHasThemeDesign(await assemble(ctx, chat.chatId))).toBe(false);
    await chat.close();
  });

  it("re-includes the theme design block on a follow-up when a new theme was selected", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });
    await appendTurnToChat(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [
        { type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default function App(){return null;}" },
      ],
      userMessage: "first turn",
      promptId: "t1",
    });
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug });

    // User picks a different theme → marker (atlas) now differs from active (matrix).
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "matrix" });
    const messages = await assemble(ctx, chat.chatId);
    expect(systemHasThemeDesign(messages)).toBe(true);
    await chat.close();
  });

  it("re-includes the theme once on a legacy follow-up that has no marker yet", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });
    await appendTurnToChat(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [
        { type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default function App(){return null;}" },
      ],
      userMessage: "first turn",
      promptId: "t1",
    });
    // No persist call → no marker (pre-feature chats). Follow-up should still send
    // the theme once (marker absent ≠ active theme).
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBeUndefined();
    expect(systemHasThemeDesign(await assemble(ctx, chat.chatId))).toBe(true);
    await chat.close();
  });

  it("persistCodegenThemeMarker writes the active theme as the marker and is idempotent", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "matrix" });

    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug });
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBe("matrix");

    // Idempotent: a second call with the same active theme leaves one marker.
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug });
    const t = ctx.appCtx.vibesCtx.sql.tables.appSettings;
    const row = await ctx.appCtx.vibesCtx.sql.db
      .select({ settings: t.settings })
      .from(t)
      .where(eq(t.appSlug, appSlug))
      .limit(1)
      .then((r) => r[0]);
    const { filtered } = parseArrayWarning((row?.settings ?? []) as ActiveEntry[], ActiveEntry);
    expect(filtered.filter(isActiveCodegenTheme)).toHaveLength(1);
  });
});
