import { VibesDiyApi, VibesDiyApiParam } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createIsolatedDB } from "./globalSetup.libsql.js";

function wireUpWsPair(wsPair: ReturnType<typeof TestWSPair.create>, appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>) {
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return wsSendProvider;
}

describe("WebSocket disconnection", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi;
  let wsPair: ReturnType<typeof TestWSPair.create>;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let fetchPair: ReturnType<typeof TestFetchPair.create>;
  let getToken: VibesDiyApiParam["getToken"];

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const isolatedDbUrl = await createIsolatedDB(import.meta.dirname, "ws-reconnect");
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, isolatedDbUrl);
    const testUser = await createTestUser({ sthis, deviceCA });
    getToken = async () => Result.Ok(await testUser.getDashBoardToken());

    fetchPair = TestFetchPair.create();
    wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({
              client: wsPair.p1,
              server: wsPair.p2,
            }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    wireUpWsPair(wsPair, appCtx);

    api = new VibesDiyApi({
      apiUrl: "http://localhost:9999/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 2000,
      getToken,
    });
  });

  it("successful request before disconnect", async () => {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "function App() { return <div>Hello</div>; }",
        },
      ],
    });
    if (rRes.isErr()) {
      assert.fail("Expected ensureAppSlug to succeed, got: " + JSON.stringify(rRes.Err()));
    }
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    expect(res.appSlug).toBeTruthy();
  });

  it("send on dead WebSocket returns websocket-send-failed error", async () => {
    // Simulate the WebSocket dying (e.g. network disconnect, backgrounded tab)
    const ws = wsPair.p1 as unknown as WebSocket;
    Object.defineProperty(ws, "readyState", { value: 3 /* WebSocket.CLOSED */, writable: true, configurable: true });

    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "function App() { return <div>Dead</div>; }",
        },
      ],
    });

    // Should get a clean Result.Err with websocket-send-failed, not a thrown exception
    expect(rRes.isErr()).toBe(true);
    const err = rRes.Err();
    expect(err).toMatchObject({
      code: "websocket-send-failed",
      message: expect.stringContaining("Reconnecting, please retry"),
    });
  });

  it("reconnects with a fresh WebSocket after cache eviction", async () => {
    // Previous test evicted the connection cache via send failure.
    // Create a completely new WS pair + API instance on the same URL
    // to prove the cached dead connection was removed.
    const freshWsPair = TestWSPair.create();
    wireUpWsPair(freshWsPair, appCtx);

    const freshApi = new VibesDiyApi({
      apiUrl: "http://localhost:9999/api",
      ws: freshWsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 2000,
      getToken,
    });

    const rRes = await freshApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "function App() { return <div>Reconnected</div>; }",
        },
      ],
    });

    if (rRes.isErr()) {
      assert.fail("Expected ensureAppSlug to succeed after reconnect, got: " + JSON.stringify(rRes.Err()));
    }
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk after reconnect");
    }
    expect(res.appSlug).toBeTruthy();
  });
});
