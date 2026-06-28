import { describe, it, expect, beforeAll, inject } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createTestUserWithPublicMeta } from "./create-test-user-with-public-meta.js";

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

const TEST_USER_ID = "get-app-chat-test-user";

// A minimal valid blocks array to seed — uses prompt.block-begin which only
// requires the PromptBase fields (streamId, chatId, seq, timestamp).
const SEED_BLOCKS = [
  {
    type: "prompt.block-begin",
    streamId: "test-stream-id",
    chatId: "app-chat-id-alpha",
    seq: 0,
    timestamp: "2026-06-20T10:00:00.000Z",
  },
  {
    type: "prompt.req",
    request: { messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }] },
    streamId: "test-stream-id",
    chatId: "app-chat-id-alpha",
    seq: 1,
    timestamp: "2026-06-20T10:00:01.000Z",
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

    // Seed ApplicationChats rows for the test user
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.applicationChats).values([
      {
        chatId: "app-chat-id-alpha",
        userId: TEST_USER_ID,
        appSlug: "my-app",
        ownerHandle: "bob",
        blocks: SEED_BLOCKS,
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
  }, TIMEOUT);

  it("returns blocks for a known chatId", async () => {
    const r = await api.getApplicationChat({ chatId: "app-chat-id-alpha" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-get-application-chat");
    expect(body.chatId).toBe("app-chat-id-alpha");
    expect(body.appSlug).toBe("my-app");
    expect(body.ownerHandle).toBe("bob");
    expect(body.blocks.length).toBeGreaterThan(0);
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
