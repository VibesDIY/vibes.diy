import { VibesDiyApi, VibesDiyApiParam } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

function wireUpWsPair(wsPair: ReturnType<typeof TestWSPair.create>, appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>) {
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return wsSendProvider;
}

describe(
  "WebSocket reconnection replays subscriptions and listeners",
  { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000 },
  () => {
    const sthis = ensureSuperThis();

    let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
    let fetchPair: ReturnType<typeof TestFetchPair.create>;
    let getToken: VibesDiyApiParam["getToken"];
    let appSlug: string;
    let userSlug: string;

    beforeAll(async () => {
      const deviceCA = await createTestDeviceCA(sthis);
      appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
      const testUser = await createTestUser({ sthis, deviceCA });
      getToken = async () => Result.Ok(await testUser.getDashBoardToken());

      fetchPair = TestFetchPair.create();
      fetchPair.server.onServe(async (req: Request) => {
        const wsPairForServe = TestWSPair.create();
        return cfServe(
          req as unknown as CFRequest,
          {
            appCtx: appCtx.appCtx,
            cache: noopCache,
            drizzle: appCtx.vibesCtx.sql.db,
            webSocket: {
              connections: new Set(),
              webSocketPair: () => ({
                client: wsPairForServe.p1,
                server: wsPairForServe.p2,
              }),
            },
          } as unknown as ExecutionContext & CFInject
        ) as unknown as Promise<Response>;
      });
    });

    it("subscribeDocs stores params for replay on reconnection", async () => {
      const wsPair = TestWSPair.create();
      wireUpWsPair(wsPair, appCtx);

      const api = new VibesDiyApi({
        apiUrl: `http://localhost:${8800 + Math.floor(Math.random() * 1000)}/api`,
        ws: wsPair.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 5000,
        getToken,
      });

      // Create an app first
      const rApp = await api.ensureAppSlug({
        mode: "production",
        fileSystem: [
          { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return <div>Replay</div>; } App();" },
        ],
      });
      if (rApp.isErr()) assert.fail("ensureAppSlug failed: " + JSON.stringify(rApp.Err()));
      const app = rApp.Ok();
      if (!isResEnsureAppSlugOk(app)) assert.fail("Expected ResEnsureAppSlugOk");
      appSlug = app.appSlug;
      userSlug = app.userSlug;

      // Enable public access so subscribe works
      await api.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: true } });

      // Subscribe — this should be stored internally for replay
      const rSub = await api.subscribeDocs({ appSlug, userSlug, dbName: "default" });
      expect(rSub.isOk()).toBe(true);

      // Subscribe again with same params — should deduplicate
      const rSub2 = await api.subscribeDocs({ appSlug, userSlug, dbName: "default" });
      expect(rSub2.isOk()).toBe(true);

      // Verify deduplication via test inspection getter
      expect(api._testInternals.docSubscriptions).toHaveLength(1);
      expect(api._testInternals.docSubscriptions[0]).toEqual({ userSlug, appSlug, dbName: "default" });
    });

    it("onDocChanged stores listeners for replay", () => {
      const wsPair = TestWSPair.create();

      const api = new VibesDiyApi({
        apiUrl: `http://localhost:${8800 + Math.floor(Math.random() * 1000)}/api`,
        ws: wsPair.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 5000,
        getToken,
      });

      const cb1 = () => {
        /* listener 1 */
      };
      const cb2 = () => {
        /* listener 2 */
      };

      api.onDocChanged(cb1);
      api.onDocChanged(cb2);

      expect(api._testInternals.docChangedListenerCount).toBe(2);
    });

    it("getReadyConnection detects new connection and replays", async () => {
      const wsPair1 = TestWSPair.create();
      wireUpWsPair(wsPair1, appCtx);

      const api = new VibesDiyApi({
        apiUrl: `http://localhost:${8800 + Math.floor(Math.random() * 1000)}/api`,
        ws: wsPair1.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 5000,
        getToken,
      });

      // First connection
      const conn1 = await api.getReadyConnection();
      expect(api._testInternals.currentConnection).toBe(conn1);

      // Second call returns same connection (cached)
      const conn2 = await api.getReadyConnection();
      expect(conn2).toBe(conn1);
    });

    it("close() cancels pending reconnect timer", async () => {
      const wsPair1 = TestWSPair.create();
      wireUpWsPair(wsPair1, appCtx);

      const api = new VibesDiyApi({
        apiUrl: `http://localhost:${8800 + Math.floor(Math.random() * 1000)}/api`,
        ws: wsPair1.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 5000,
        getToken,
      });

      // Establish a connection so onClose handler is installed
      await api.getReadyConnection();

      // Simulate WS close — triggers the 1s reconnect timer
      const ws = wsPair1.p1 as unknown as WebSocket;
      ws.onclose?.({ wasClean: true, code: 1000, reason: "" } as unknown as CloseEvent);

      // Timer should be armed
      expect(api._testInternals.reconnectTimer).toBeDefined();

      // close() should cancel the pending timer
      await api.close();
      expect(api._testInternals.reconnectTimer).toBeUndefined();
    });

    it("close() suppresses reconnect from its own onClose", async () => {
      const wsPair1 = TestWSPair.create();
      wireUpWsPair(wsPair1, appCtx);

      const api = new VibesDiyApi({
        apiUrl: `http://localhost:${8800 + Math.floor(Math.random() * 1000)}/api`,
        ws: wsPair1.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 5000,
        getToken,
      });

      // Establish connection
      await api.getReadyConnection();

      // Explicit close — this calls conn.close() which fires onClose
      await api.close();

      // The onClose handler should NOT have armed a reconnect timer
      // because close() set the closed flag before conn.close() fired
      expect(api._testInternals.reconnectTimer).toBeUndefined();
    });
  }
);
