import { describe, it, expect, beforeAll, inject } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createTestUserWithPublicMeta } from "./create-test-user-with-public-meta.js";

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

const TEST_USER_ID = "get-app-chat-test-user";

// The transcript for a runtime/img chat lives in ChatSections (keyed by chatId),
// NOT in ApplicationChats.blocks — which is initialized to `[]` on creation and
// never updated. This is the `jchris/photo-chat` shape that motivated the split:
// an ApplicationChats row with zero inline blocks but a full ChatSections history.
//
// We seed two turns out of insertion order to prove the handler reassembles them
// chronologically (turn `prompt-1` before `prompt-2`) and orders sections within a
// turn by `blockSeq`. The blocks use prompt.block-begin / prompt.req shapes, which
// only require the PromptBase fields (streamId, chatId, seq, timestamp).
const ALPHA_CHAT_SECTIONS = [
  // prompt-2 (newer turn) — listed first to exercise the chronological sort.
  {
    chatId: "app-chat-id-alpha",
    promptId: "prompt-2",
    blockSeq: 0,
    created: "2026-06-20T10:05:00.000Z",
    blocks: [
      {
        type: "prompt.block-begin",
        streamId: "stream-2",
        chatId: "app-chat-id-alpha",
        seq: 0,
        timestamp: "2026-06-20T10:05:00.000Z",
      },
    ],
  },
  // prompt-1 (older turn) — second section (blockSeq 1) listed before blockSeq 0.
  {
    chatId: "app-chat-id-alpha",
    promptId: "prompt-1",
    blockSeq: 1,
    created: "2026-06-20T10:00:01.000Z",
    blocks: [
      {
        type: "prompt.block-begin",
        streamId: "stream-1b",
        chatId: "app-chat-id-alpha",
        seq: 1,
        timestamp: "2026-06-20T10:00:02.000Z",
      },
    ],
  },
  {
    chatId: "app-chat-id-alpha",
    promptId: "prompt-1",
    blockSeq: 0,
    created: "2026-06-20T10:00:01.000Z",
    blocks: [
      {
        type: "prompt.req",
        request: { messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] },
        streamId: "stream-1a",
        chatId: "app-chat-id-alpha",
        seq: 0,
        timestamp: "2026-06-20T10:00:01.000Z",
      },
    ],
  },
];

describe("get-application-chat", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

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

    const testUser = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: TEST_USER_ID,
      publicMeta: {},
    });

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    // Seed ApplicationChats rows (ownership anchors) with empty inline blocks —
    // matching production, where this column is never written. The real
    // transcript is seeded into ChatSections below.
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.applicationChats).values([
      {
        chatId: "app-chat-id-alpha",
        userId: TEST_USER_ID,
        appSlug: "my-app",
        ownerHandle: "bob",
        blocks: [],
        created: "2026-06-20T10:00:00.000Z",
      },
      {
        chatId: "app-chat-id-beta",
        userId: TEST_USER_ID,
        appSlug: "other-app",
        ownerHandle: "bob",
        blocks: [],
        created: "2026-06-19T10:00:00.000Z",
      },
    ]);

    // Seed the alpha chat's transcript into ChatSections (beta intentionally has
    // none, so it resolves to empty blocks).
    await appCtx.vibesCtx.sql.db.insert(t.chatSections).values(ALPHA_CHAT_SECTIONS);
  }, TIMEOUT);

  it("reassembles ChatSections blocks chronologically by turn then blockSeq", async () => {
    const r = await api.getApplicationChat({ chatId: "app-chat-id-alpha" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-get-application-chat");
    expect(body.chatId).toBe("app-chat-id-alpha");
    expect(body.appSlug).toBe("my-app");
    expect(body.ownerHandle).toBe("bob");
    // Three seeded blocks across two turns. Order is older turn (prompt-1) first —
    // blockSeq 0 (prompt.req) then blockSeq 1 — then the newer turn (prompt-2),
    // proving both the cross-turn chronological sort and within-turn blockSeq sort.
    expect(body.blocks.length).toBe(3);
    expect((body.blocks[0] as { type: string }).type).toBe("prompt.req");
    expect(body.blocks.map((b) => (b as { seq: number }).seq)).toEqual([0, 1, 0]);
  });

  it("returns empty blocks for an unknown chatId (no error)", async () => {
    const r = await api.getApplicationChat({ chatId: "no-such-chat-id" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-get-application-chat");
    expect(body.blocks).toEqual([]);
  });

  it("returns empty blocks for a chatId belonging to a different appSlug", async () => {
    const r = await api.getApplicationChat({ chatId: "app-chat-id-alpha", appSlug: "wrong-app", ownerHandle: "bob" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.blocks).toEqual([]);
  });

  it("scopes by appSlug + ownerHandle when both provided", async () => {
    const r = await api.getApplicationChat({ chatId: "app-chat-id-alpha", appSlug: "my-app", ownerHandle: "bob" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.chatId).toBe("app-chat-id-alpha");
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it("returns empty blocks for a chat row with no blocks", async () => {
    const r = await api.getApplicationChat({ chatId: "app-chat-id-beta" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.chatId).toBe("app-chat-id-beta");
    expect(body.blocks).toEqual([]);
  });
});
