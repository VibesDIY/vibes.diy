import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createIsolatedDB } from "./globalSetup.libsql.js";

describe("WebSocket disconnection", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi;
  let wsPair: ReturnType<typeof TestWSPair.create>;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const isolatedDbUrl = await createIsolatedDB(import.meta.dirname, "ws-reconnect");
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, isolatedDbUrl);
    const testUser = await createTestUser({ sthis, deviceCA });

    const fetchPair = TestFetchPair.create();
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

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:9999/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 2000,
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
      },
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

  it("send on dead WebSocket returns error instead of throwing", async () => {
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

    // Should get a clean timeout error, not an uncaught "CLOSING or CLOSED" exception
    expect(rRes.isErr()).toBe(true);
  });

  it("reconnects after dead WebSocket when readyState recovers", async () => {
    // Reset readyState to OPEN so the mock can send again
    const ws = wsPair.p1 as unknown as WebSocket;
    Object.defineProperty(ws, "readyState", { value: 1 /* WebSocket.OPEN */, writable: true, configurable: true });

    // The previous test cleared the connection cache, so this should create a fresh connection
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "function App() { return <div>Recovered</div>; }",
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
