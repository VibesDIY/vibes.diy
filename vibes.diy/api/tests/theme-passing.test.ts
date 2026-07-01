import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { processStream } from "@adviser/cement";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { assemblePromptPayload, persistCodegenThemeMarker } from "@vibes.diy/api-svc";
import {
  isActiveCodegenTheme,
  isSectionEvent,
  parseArrayWarning,
  ActiveEntry,
  type ActiveEnrichedPrompt,
} from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { appendTurnToChat } from "../svc/intern/append-turn-to-chat.js";

const THEME_SEQ_BASE = 1_696_400;

function systemText(messages: ChatMessage[]): string {
  const sys = messages.find((m) => m.role === "system");
  return sys?.content.map((c) => (c.type === "text" ? c.text : "")).join("") ?? "";
}

// The theme design guidance is wrapped in <theme-design-md> by makeBaseSystemPrompt.
function systemHasThemeDesign(messages: ChatMessage[]): boolean {
  return systemText(messages).includes("<theme-design-md>");
}

// A stable marker of the built-in default (neobrutalist) style prompt.
function systemHasDefaultStyle(messages: ChatMessage[]): boolean {
  return systemText(messages).includes("Neobrutalist Design System");
}

// The enriched-prompt preamble is wrapped in <app-workflow>.
function systemHasEnrichedPrompt(messages: ChatMessage[]): boolean {
  return systemText(messages).includes("<app-workflow>");
}

// Append an active.enriched-prompt entry (normally seeded by pre-allocation)
// straight into the app_settings row so the assembly path reads it.
async function seedEnrichedPrompt(
  ctx: ApiTestCtx,
  userId: string,
  ownerHandle: string,
  appSlug: string,
  text: string
): Promise<void> {
  const t = ctx.appCtx.vibesCtx.sql.tables.appSettings;
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ settings: t.settings })
    .from(t)
    .where(and(eq(t.appSlug, appSlug), eq(t.ownerHandle, ownerHandle), eq(t.userId, userId)))
    .limit(1)
    .then((r) => r[0]);
  const { filtered } = parseArrayWarning((row?.settings ?? []) as ActiveEntry[], ActiveEntry);
  const entry: ActiveEnrichedPrompt = { type: "active.enriched-prompt", enrichedPrompt: text };
  const next: ActiveEntry[] = [...filtered.filter((e) => e.type !== "active.enriched-prompt"), entry];
  await ctx.appCtx.vibesCtx.sql.db
    .update(t)
    .set({ settings: next, updated: new Date().toISOString() })
    .where(and(eq(t.appSlug, appSlug), eq(t.ownerHandle, ownerHandle), eq(t.userId, userId)));
}

// Drive a full codegen turn to completion. handleEndMsg emits an EARLY
// prompt.block-end (fast UI release) BEFORE handlePromptContext runs the fs
// commit + codegen-theme marker write, so seeing block-end doesn't guarantee the
// marker is persisted yet. We close on block-end, then the caller polls.
async function runTurnToBlockEnd(chat: { sectionStream: ReadableStream<unknown>; close: () => Promise<void> }): Promise<void> {
  await processStream(chat.sectionStream, async (msg) => {
    if (isSectionEvent(msg) && msg.blocks.some((b) => b.type === "prompt.block-end")) {
      await chat.close();
    }
  });
}

async function pollMarker(ctx: ApiTestCtx, ownerHandle: string, appSlug: string, want: string): Promise<string | undefined> {
  for (let i = 0; i < 40; i++) {
    const m = await readMarker(ctx, ownerHandle, appSlug);
    if (m === want) return m;
    await new Promise((r) => setTimeout(r, 50));
  }
  return readMarker(ctx, ownerHandle, appSlug);
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
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "atlas" });
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBe("atlas");

    // The theme design block is dropped AND the default style prompt is NOT
    // substituted in its place — the follow-up carries no restyle guidance.
    const messages = await assemble(ctx, chat.chatId);
    expect(systemHasThemeDesign(messages)).toBe(false);
    expect(systemHasDefaultStyle(messages)).toBe(false);
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
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "atlas" });

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

  it("persistCodegenThemeMarker records the passed theme and is idempotent", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "matrix" });

    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "matrix" });
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBe("matrix");

    // Idempotent: a second call with the same theme leaves one marker.
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "matrix" });
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

  it("records the ASSEMBLED theme, not a fresh read of active.theme (in-flight change)", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    // The turn was assembled against "atlas". Mid-flight the user switches the
    // live setting to "matrix". Completion must record the ASSEMBLED theme
    // (atlas) — otherwise the next matrix turn would see marker == active and
    // wrongly skip the theme design block.
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "matrix" });
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "atlas" });
    expect(await readMarker(ctx, ownerHandle, appSlug)).toBe("atlas");
  });

  // Charlie #2998 review: explicit enrichedPrompt matrix. It rides the SAME
  // includeTheme gate as the theme block — present on the initial turn and on a
  // theme-change follow-up, absent on an ordinary (unchanged-theme) follow-up.
  it("gates the enriched-prompt preamble on initial / theme-change, not ordinary follow-ups", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForHandle(ctx, ownerHandle);
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });
    await seedEnrichedPrompt(ctx, userId, ownerHandle, appSlug, "This app helps you track things together.");

    // Initial turn (empty timeline) → preamble present.
    expect(systemHasEnrichedPrompt(await assemble(ctx, chat.chatId))).toBe(true);

    // Complete a turn and record the marker → ordinary follow-up omits it.
    await appendTurnToChat(ctx.appCtx.vibesCtx, {
      chatId: chat.chatId,
      userId,
      ownerHandle,
      appSlug,
      fileSystem: [
        { type: "code-block", filename: "/App.jsx", lang: "jsx", content: "export default function App(){return null;}" },
      ],
      userMessage: "first turn",
      promptId: "e1",
    });
    await persistCodegenThemeMarker(ctx.appCtx.vibesCtx, { userId, ownerHandle, appSlug, theme: "atlas" });
    expect(systemHasEnrichedPrompt(await assemble(ctx, chat.chatId))).toBe(false);

    // Theme change → preamble re-injected alongside the theme block.
    await ctx.api.ensureAppSettings({ appSlug, ownerHandle, theme: "matrix" });
    expect(systemHasEnrichedPrompt(await assemble(ctx, chat.chatId))).toBe(true);
    await chat.close();
  });
});

// The committable codegen fixture (an OpenRouter SSE stream carrying a jsx block).
const CODEGEN_FIXTURE = readFileSync(new URL("./fixture.llm", import.meta.url), "utf8");

// Charlie #2998 review: lock the write-site gating (mode === codegen +
// fsRef.IsSome()). A real codegen turn that commits a filesystem must stamp the
// codegen-theme marker with the theme it was assembled against. Uses a local ctx
// (unique port) with an llmRequest that always streams committable code.
describe("theme passing: codegen-theme marker write site", () => {
  let local: ApiTestCtx;
  beforeAll(async () => {
    local = await createApiTestCtx({
      seqUserIdBase: THEME_SEQ_BASE + 5000,
      apiUrlPort: 8799,
      llmRequest: async () => new Response(CODEGEN_FIXTURE, { status: 200 }),
    });
  });

  it("stamps the marker after a codegen turn that commits a filesystem", async () => {
    const { appSlug, ownerHandle } = await local.createApp();
    const rOpen = await local.api.openChat({ ownerHandle, appSlug, mode: "codegen" });
    const chat = rOpen.Ok();
    await local.api.ensureAppSettings({ appSlug, ownerHandle, theme: "atlas" });
    expect(await readMarker(local, ownerHandle, appSlug)).toBeUndefined();

    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: "build the app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    await runTurnToBlockEnd(chat);

    // Assembled against atlas and committed a filesystem → marker stamped.
    expect(await pollMarker(local, ownerHandle, appSlug, "atlas")).toBe("atlas");
  }, 20000);
});
