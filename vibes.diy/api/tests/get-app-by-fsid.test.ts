import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("getAppByFsId grant flow", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // requester
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 100 });

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
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 200 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  async function createApp() {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Hello ${now}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug };
  }

  it("getAppByFsId returns pending-request after requestAccess", async () => {
    const { appSlug, userSlug } = await createApp();

    // Enable request access (no auto-approve)
    await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    // Non-owner requests access
    const rRequested = await api2.requestAccess({ appSlug, userSlug });
    if (rRequested.isErr()) {
      assert.fail("Expected requestAccess to succeed: " + JSON.stringify(rRequested.Err()));
    }
    expect(rRequested.Ok().state).toBe("pending");

    // Now getAppByFsId as non-owner should return pending-request, not not-grant
    const rApp = await api2.getAppByFsId({ appSlug, userSlug });
    if (rApp.isErr()) {
      assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    }
    expect(rApp.Ok().grant).toBe("pending-request");
  });

  it("getAppByFsId returns pending-request on first visit (implicit requestAccess)", async () => {
    const { appSlug, userSlug } = await createApp();

    // Enable request access (no auto-approve)
    await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    // Non-owner calls getAppByFsId without prior requestAccess — should create the
    // request implicitly and return pending-request
    const rApp = await api2.getAppByFsId({ appSlug, userSlug });
    if (rApp.isErr()) {
      assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    }
    expect(rApp.Ok().grant).toBe("pending-request");
  });

  it("getAppByFsId auto-approves and grants access when autoAcceptViewRequest is enabled", async () => {
    const { appSlug, userSlug } = await createApp();

    // Enable request access with auto-approve
    await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptViewRequest: true } });

    // Non-owner visits — should be auto-approved on first getAppByFsId
    const rApp = await api2.getAppByFsId({ appSlug, userSlug });
    if (rApp.isErr()) {
      assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    }
    expect(rApp.Ok().grant).toBe("granted-access.viewer");
  });

  it("getAppByFsId returns not-grant when request access is disabled", async () => {
    const { appSlug, userSlug } = await createApp();

    // No enableRequest, no publicAccess — non-owner should get not-grant
    const rApp = await api2.getAppByFsId({ appSlug, userSlug });
    if (rApp.isErr()) {
      assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    }
    expect(rApp.Ok().grant).toBe("not-grant");
  });

  it("getAppByFsId returns owner for app owner", async () => {
    const { appSlug, userSlug } = await createApp();

    const rApp = await api.getAppByFsId({ appSlug, userSlug });
    if (rApp.isErr()) {
      assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    }
    expect(rApp.Ok().grant).toBe("owner");
  });
});
