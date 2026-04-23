import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("Firefly public subscribeDocs", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let anonApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });

    anonApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Err("no auth"),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "production",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Subscribe Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: true } });
  });

  it("public subscribeDocs succeeds without auth", async () => {
    const rRes = await anonApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("owner can still subscribe", async () => {
    const rRes = await ownerApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });
});

describe("Firefly non-public subscribeDocs denied", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let anonApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });

    anonApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Err("no auth"),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>No Public</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;
    // publicAccess NOT enabled
  });

  it("non-public subscribeDocs denied without auth", async () => {
    const rRes = await anonApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });
});
