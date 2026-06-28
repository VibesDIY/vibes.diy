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

const TEST_USER_ID = "codegen-chats-test-user";

describe("list-codegen-chats", { timeout: TIMEOUT }, () => {
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

    // Seed ChatContexts rows for the test user
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.chatContexts).values([
      {
        chatId: "chat-id-newest",
        userId: TEST_USER_ID,
        appSlug: "my-vibe",
        ownerHandle: "alice",
        created: "2026-06-20T12:00:00.000Z",
      },
      {
        chatId: "chat-id-middle",
        userId: TEST_USER_ID,
        appSlug: "my-vibe",
        ownerHandle: "alice",
        created: "2026-06-19T12:00:00.000Z",
      },
      {
        chatId: "chat-id-oldest",
        userId: TEST_USER_ID,
        appSlug: "my-vibe",
        ownerHandle: "alice",
        created: "2026-06-18T12:00:00.000Z",
      },
      {
        chatId: "chat-id-other-vibe",
        userId: TEST_USER_ID,
        appSlug: "other-vibe",
        ownerHandle: "alice",
        created: "2026-06-17T12:00:00.000Z",
      },
    ]);
  }, TIMEOUT);

  it("lists codegen chats for userId+appSlug+ownerHandle ordered by created desc", async () => {
    const r = await api.listCodegenChats({ appSlug: "my-vibe", ownerHandle: "alice" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-list-codegen-chats");
    expect(body.items).toHaveLength(3);
    expect(body.items[0].chatId).toBe("chat-id-newest");
    expect(body.items[1].chatId).toBe("chat-id-middle");
    expect(body.items[2].chatId).toBe("chat-id-oldest");
    expect(body.items[0].appSlug).toBe("my-vibe");
    expect(body.items[0].ownerHandle).toBe("alice");
    expect(body.nextCursor).toBeUndefined();
  });

  it("returns empty array when no ChatContexts rows exist for a vibe", async () => {
    const r = await api.listCodegenChats({ appSlug: "no-such-vibe", ownerHandle: "alice" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-list-codegen-chats");
    expect(body.items).toHaveLength(0);
    expect(body.nextCursor).toBeUndefined();
  });

  it("paginates with limit and returns nextCursor when more rows exist", async () => {
    const r = await api.listCodegenChats({ appSlug: "my-vibe", ownerHandle: "alice", limit: 2 });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    expect(body.type).toBe("vibes.diy.res-list-codegen-chats");
    expect(body.items).toHaveLength(2);
    expect(body.items[0].chatId).toBe("chat-id-newest");
    expect(body.items[1].chatId).toBe("chat-id-middle");
    expect(body.nextCursor).toBe("2026-06-19T12:00:00.000Z");

    // Fetch next page using cursor
    const r2 = await api.listCodegenChats({
      appSlug: "my-vibe",
      ownerHandle: "alice",
      limit: 2,
      cursor: body.nextCursor,
    });
    expect(r2.isOk()).toBe(true);
    const body2 = r2.Ok();
    expect(body2.items).toHaveLength(1);
    expect(body2.items[0].chatId).toBe("chat-id-oldest");
    expect(body2.nextCursor).toBeUndefined();
  });

  it("regression: a vibe with codegen history but no ApplicationChats rows is listed", async () => {
    // This is the photo-chat bug shape: listApplicationChats returned empty
    // but listCodegenChats should now surface the rows.
    const r = await api.listCodegenChats({ appSlug: "my-vibe", ownerHandle: "alice" });
    expect(r.isOk()).toBe(true);
    const body = r.Ok();
    // We have 3 chatContexts rows for my-vibe and 0 applicationChats rows
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.appSlug === "my-vibe")).toBe(true);
  });
});
