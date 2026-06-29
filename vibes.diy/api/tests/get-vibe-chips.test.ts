import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, type PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { and, eq } from "drizzle-orm/sql/expressions";

// #2755 — the anonymous suggestion-chips read path. `getVibeChips` is the
// dedicated projection endpoint: it returns ONLY the latest turn's `▸` chips and
// is gated on app-access VISIBILITY (public-readable, or a signed-in
// owner/member), not owner-scope. These tests drive the gate end-to-end by
// seeding a chips-bearing chat turn directly, then reading it as owner /
// gated-non-owner / public-non-owner. The pure chip-parse semantics
// (drop-terminal, cap-3, fsId preference) are covered separately in
// latest-vibe-chips.test.ts.
describe("getVibeChips access gate", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // non-owner
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 400 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  // Build the toplevel.line narration blocks for one stored turn — one line per
  // block, exactly as the real stream emits them. The trailing `▸` group is what
  // `latestTurnChips` projects into chips.
  function chipTurnBlocks(chatId: string, promptId: string, lines: string[]): PromptAndBlockMsgs[] {
    const now = new Date();
    return lines.map(
      (line, i) =>
        ({
          type: "block.toplevel.line",
          sectionId: `${promptId}-sec`,
          blockId: `${promptId}-blk`,
          streamId: `${promptId}-stream`,
          seq: i,
          blockNr: 0,
          timestamp: now,
          lineNr: i,
          line,
        }) as unknown as PromptAndBlockMsgs
    );
  }

  // Seed a chips-bearing chat turn for an existing app: a ChatContexts row (the
  // ownership pivot getVibeChips joins on), a ChatSections turn, and a
  // PromptContexts row carrying the turn's `fsId`/`created` so the version-pinned
  // chip selection (and the public "only the published version" filter) can be
  // exercised.
  async function seedChipChat(
    appSlug: string,
    ownerHandle: string,
    lines: string[],
    opts?: { fsId?: string; created?: string }
  ): Promise<void> {
    const chatId = sthis.nextId(8).str;
    const promptId = sthis.nextId(8).str;
    const created = opts?.created ?? new Date().toISOString();
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.chatContexts).values({
      chatId,
      userId: "seed-owner",
      appSlug,
      ownerHandle,
      created,
    });
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.chatSections).values({
      chatId,
      promptId,
      blockSeq: 0,
      blocks: chipTurnBlocks(chatId, promptId, lines),
      created,
    });
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.promptContexts).values({
      userId: "seed-owner",
      chatId,
      promptId,
      ...(opts?.fsId !== undefined ? { fsId: opts.fsId } : {}),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      ref: {},
      created,
    });
  }

  // ensureAppSlug seeds the app's own chat (a real ChatContexts + ChatSections
  // turn carrying the production fsId but no `▸` chips). That real turn would
  // shadow our seeded chip turns under latestTurnChips' newest-for-fsId pick, so
  // wipe the app's chat first and let seedChipChat be authoritative.
  async function clearChat(appSlug: string, ownerHandle: string): Promise<void> {
    const t = appCtx.vibesCtx.sql.tables;
    const ctxs = await appCtx.vibesCtx.sql.db
      .select({ chatId: t.chatContexts.chatId })
      .from(t.chatContexts)
      .where(and(eq(t.chatContexts.ownerHandle, ownerHandle), eq(t.chatContexts.appSlug, appSlug)));
    for (const { chatId } of ctxs) {
      await appCtx.vibesCtx.sql.db.delete(t.chatSections).where(eq(t.chatSections.chatId, chatId));
      await appCtx.vibesCtx.sql.db.delete(t.promptContexts).where(eq(t.promptContexts.chatId, chatId));
    }
    await appCtx.vibesCtx.sql.db
      .delete(t.chatContexts)
      .where(and(eq(t.chatContexts.ownerHandle, ownerHandle), eq(t.chatContexts.appSlug, appSlug)));
  }

  async function createApp(mode: "dev" | "production" = "dev"): Promise<{ appSlug: string; ownerHandle: string; fsId: string }> {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>${now}</div>;} App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    // The fsId the handler pins on is the resolved `apps.fsId` (what
    // selectLatestAppPerSlug returns), which getAppByFsId echoes — NOT the
    // filesystem-ref fsId in the ensureAppSlug response. Seed turns against this
    // one so the version-pin matches.
    const rApp = await api.getAppByFsId({ ownerHandle: res.ownerHandle, appSlug: res.appSlug });
    if (rApp.isErr()) assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    const fsId = rApp.Ok().fsId;
    if (fsId === undefined) assert.fail("Expected getAppByFsId to resolve an fsId");
    await clearChat(res.appSlug, res.ownerHandle);
    return { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId };
  }

  const CHIP_LINES = ["All set! Want a tweak?", "▸ Add sound", "▸ Add a timer", "▸ I'm done for now"];

  it("hides chips from a non-owner on a private vibe (gated → empty)", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("production");
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES, { fsId });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual([]);
  });

  it("serves chips to a non-owner once the vibe is public-readable (#2755)", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("production");
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES, { fsId });
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    // Terminal "I'm done for now" dropped; capped projection of the public CTAs.
    expect(r.Ok().chips).toEqual(["Add sound", "Add a timer"]);
  });

  it("serves chips to the owner on their own private (dev) vibe", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("dev");
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES, { fsId });

    const r = await api.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual(["Add sound", "Add a timer"]);
  });

  it("returns empty chips when the latest turn offered no ▸ options", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("production");
    await seedChipChat(appSlug, ownerHandle, ["Here is your app.", "No options were offered."], { fsId });
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual([]);
  });

  // Charlie blocking item (#2755): on the public path `fsId` is usually omitted,
  // and `latestTurnChips`'s fallback-to-newest would surface chips from a newer
  // UNPUBLISHED draft turn the owner started after publishing. Public reads must
  // pin to the published row's fsId and never fall through to a draft turn.
  it("pins public chips to the published version, ignoring a newer draft turn", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("production");
    // Older published turn (matches the production row's fsId).
    await seedChipChat(appSlug, ownerHandle, ["Published.", "▸ Published chip"], {
      fsId,
      created: "2026-06-27T01:00:00Z",
    });
    // Newer dev-draft turn on a different fsId — must NOT leak to public viewers.
    await seedChipChat(appSlug, ownerHandle, ["Draft.", "▸ Secret draft chip"], {
      fsId: "dev-draft-fsid",
      created: "2026-06-27T02:00:00Z",
    });
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual(["Published chip"]);
  });

  // Codex P2 (#2755): the gate must mirror getAppByFsId's non-owner read, which
  // honors publicAccess only for PRODUCTION rows. publicAccess is honored in dev
  // for access-fn grants, so a dev-only slug carrying it must NOT leak chips.
  it("does NOT leak chips from a dev-only vibe even when publicAccess is set", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("dev");
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES, { fsId });
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual([]);
  });

  // Codex P2 (#2755): setUnpublish leaves publicAccess untouched, so a
  // soft-unpublished slug would still pass an isPublicReadable-only gate.
  // isHiddenForCaller (the tombstone) must stop the chip projection for non-owners.
  it("does NOT leak chips from a soft-unpublished public vibe to a non-owner", async () => {
    const { appSlug, ownerHandle, fsId } = await createApp("production");
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES, { fsId });
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    // Sanity: public + production → visible before unpublish.
    const rBefore = await api2.getVibeChips({ ownerHandle, appSlug });
    if (rBefore.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(rBefore.Err()));
    expect(rBefore.Ok().chips).toEqual(["Add sound", "Add a timer"]);

    // Soft-unpublish (publicAccess stays set) → the tombstone hides it from non-owners.
    await api.setUnpublish({ ownerHandle, appSlug, unpublish: true });
    const rAfter = await api2.getVibeChips({ ownerHandle, appSlug });
    if (rAfter.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(rAfter.Err()));
    expect(rAfter.Ok().chips).toEqual([]);

    // The owner still sees through the tombstone.
    const rOwner = await api.getVibeChips({ ownerHandle, appSlug });
    if (rOwner.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(rOwner.Err()));
    expect(rOwner.Ok().chips).toEqual(["Add sound", "Add a timer"]);
  });
});
