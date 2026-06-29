import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, type PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

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

  // Seed a chips-bearing chat for an existing app: a ChatContexts row (the
  // ownership pivot getVibeChips joins on) + one ChatSections turn.
  async function seedChipChat(appSlug: string, ownerHandle: string, lines: string[]): Promise<void> {
    const chatId = sthis.nextId(8).str;
    const promptId = sthis.nextId(8).str;
    const created = new Date().toISOString();
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
  }

  async function createApp(): Promise<{ appSlug: string; ownerHandle: string }> {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>${now}</div>;} App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    return { appSlug: res.appSlug, ownerHandle: res.ownerHandle };
  }

  const CHIP_LINES = ["All set! Want a tweak?", "▸ Add sound", "▸ Add a timer", "▸ I'm done for now"];

  it("hides chips from a non-owner on a private vibe (gated → empty)", async () => {
    const { appSlug, ownerHandle } = await createApp();
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES);

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual([]);
  });

  it("serves chips to a non-owner once the vibe is public-readable (#2755)", async () => {
    const { appSlug, ownerHandle } = await createApp();
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES);
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    // Terminal "I'm done for now" dropped; capped projection of the public CTAs.
    expect(r.Ok().chips).toEqual(["Add sound", "Add a timer"]);
  });

  it("serves chips to the owner on their own private vibe", async () => {
    const { appSlug, ownerHandle } = await createApp();
    await seedChipChat(appSlug, ownerHandle, CHIP_LINES);

    const r = await api.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual(["Add sound", "Add a timer"]);
  });

  it("returns empty chips when the latest turn offered no ▸ options", async () => {
    const { appSlug, ownerHandle } = await createApp();
    await seedChipChat(appSlug, ownerHandle, ["Here is your app.", "No options were offered."]);
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const r = await api2.getVibeChips({ ownerHandle, appSlug });
    if (r.isErr()) assert.fail("Expected getVibeChips to succeed: " + JSON.stringify(r.Err()));
    expect(r.Ok().chips).toEqual([]);
  });
});
