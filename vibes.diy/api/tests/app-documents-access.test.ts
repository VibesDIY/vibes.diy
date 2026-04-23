import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("Firefly access control", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let visitorApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });
    const visitorUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });

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

    visitorApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await visitorUser.getDashBoardToken()),
    });

    // Create an app owned by ownerUser
    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Access Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Failed to create app for test");
    }
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    // Seed a document so read tests have something to find
    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "seed" }, docId: "seed-doc" });
  });

  // ── Owner access ─────────────────────────────────────────────────

  it("owner can read docs", async () => {
    const rRes = await ownerApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("owner can write docs", async () => {
    const rRes = await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "owner-write" } });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("owner can query docs", async () => {
    const rRes = await ownerApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().docs.length).toBeGreaterThan(0);
  });

  it("owner can delete docs", async () => {
    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "del-me" }, docId: "owner-del" });
    const rRes = await ownerApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "owner-del" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("owner can subscribe", async () => {
    const rRes = await ownerApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  // ── No-grant visitor (denied) ────────────────────────────────────

  it("visitor without grant cannot write", async () => {
    const rRes = await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "nope" } });
    expect(rRes.isErr()).toBe(true);
  });

  it("visitor without grant cannot read", async () => {
    const rRes = await visitorApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isErr()).toBe(true);
  });

  it("visitor without grant cannot query", async () => {
    const rRes = await visitorApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  it("visitor without grant cannot delete", async () => {
    const rRes = await visitorApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isErr()).toBe(true);
  });

  it("visitor without grant cannot subscribe", async () => {
    const rRes = await visitorApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  // ── Editor grant (read + write) ──────────────────────────────────

  describe("editor grant", () => {
    beforeAll(async () => {
      // Enable requests with auto-accept as editor
      await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "editor" } });
      // Visitor requests access → auto-approved as editor
      const rReq = await visitorApi.requestAccess({ appSlug, userSlug });
      const req = rReq.Ok();
      if (!isResRequestAccessApproved(req)) assert.fail("Expected auto-approved");
      expect(req.role).toBe("editor");
    });

    it("editor can read", async () => {
      const rRes = await visitorApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
      expect(rRes.isOk()).toBe(true);
      expect(rRes.Ok().status).toBe("ok");
    });

    it("editor can write", async () => {
      const rRes = await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "editor-write" } });
      expect(rRes.isOk()).toBe(true);
      expect(rRes.Ok().status).toBe("ok");
    });

    it("editor can query", async () => {
      const rRes = await visitorApi.queryDocs({ appSlug, userSlug, dbName: "default" });
      expect(rRes.isOk()).toBe(true);
    });

    it("editor can delete", async () => {
      await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "ed-del" }, docId: "editor-del" });
      const rRes = await visitorApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "editor-del" });
      expect(rRes.isOk()).toBe(true);
    });

    it("editor can subscribe", async () => {
      const rRes = await visitorApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
      expect(rRes.isOk()).toBe(true);
    });
  });
});

// Separate describe for viewer and submitter so we get clean grant state

describe("Firefly viewer access", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let visitorApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });
    const visitorUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });

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

    visitorApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await visitorUser.getDashBoardToken()),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Viewer Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "seed" }, docId: "seed-doc" });

    // Grant viewer access
    await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "viewer" } });
    const rReq = await visitorApi.requestAccess({ appSlug, userSlug });
    const req = rReq.Ok();
    if (!isResRequestAccessApproved(req)) assert.fail("Expected auto-approved as viewer");
    expect(req.role).toBe("viewer");
  });

  it("viewer can read", async () => {
    const rRes = await visitorApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("viewer can query", async () => {
    const rRes = await visitorApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
  });

  it("viewer can subscribe", async () => {
    const rRes = await visitorApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
  });

  it("viewer cannot write", async () => {
    const rRes = await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "nope" } });
    expect(rRes.isErr()).toBe(true);
  });

  it("viewer cannot delete", async () => {
    const rRes = await visitorApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isErr()).toBe(true);
  });
});

describe("Firefly submitter access", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let visitorApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });
    const visitorUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });

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

    visitorApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await visitorUser.getDashBoardToken()),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Submitter Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "seed" }, docId: "seed-doc" });

    // Grant submitter access
    await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "submitter" } });
    const rReq = await visitorApi.requestAccess({ appSlug, userSlug });
    const req = rReq.Ok();
    if (!isResRequestAccessApproved(req)) assert.fail("Expected auto-approved as submitter");
    expect(req.role).toBe("submitter");
  });

  it("submitter can write", async () => {
    const rRes = await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "submitted" } });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("submitter cannot read", async () => {
    const rRes = await visitorApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isErr()).toBe(true);
  });

  it("submitter cannot query", async () => {
    const rRes = await visitorApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  it("submitter cannot subscribe", async () => {
    const rRes = await visitorApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  it("submitter can delete (write operation)", async () => {
    await visitorApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "to-del" }, docId: "sub-del" });
    const rRes = await visitorApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "sub-del" });
    expect(rRes.isOk()).toBe(true);
  });
});

describe("Firefly public access", { timeout: 15000 }, () => {
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

    // Anonymous API client — no auth token
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
          content: `function App() { return <div>Public Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "public-seed" }, docId: "pub-doc" });

    // Enable public access
    await ownerApi.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: true } });
  });

  it("public read: getDoc succeeds without auth", async () => {
    const rRes = await anonApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "pub-doc" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("public read: queryDocs succeeds without auth", async () => {
    const rRes = await anonApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().docs.length).toBeGreaterThan(0);
  });

  it("public write: putDoc denied without auth", async () => {
    const rRes = await anonApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "nope" } });
    expect(rRes.isErr()).toBe(true);
  });

  it("public write: deleteDoc denied without auth", async () => {
    const rRes = await anonApi.deleteDoc({ appSlug, userSlug, dbName: "default", docId: "pub-doc" });
    expect(rRes.isErr()).toBe(true);
  });
});

describe("Firefly pending request on public app", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let pendingApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const ownerUser = await createTestUser({ sthis, deviceCA });
    const pendingUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });

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

    pendingApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await pendingUser.getDashBoardToken()),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "production",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Pending Public</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "seed" }, docId: "seed-doc" });

    // Enable public access + requests (no auto-accept)
    await ownerApi.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: true } });
    await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    // Visitor requests access → stays pending
    const rReq = await pendingApi.requestAccess({ appSlug, userSlug });
    expect(rReq.Ok().state).toBe("pending");
  });

  it("pending user can still read public app docs", async () => {
    const rRes = await pendingApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "seed-doc" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("pending user can query public app docs", async () => {
    const rRes = await pendingApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().docs.length).toBeGreaterThan(0);
  });

  it("pending user cannot write to public app", async () => {
    const rRes = await pendingApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "nope" } });
    expect(rRes.isErr()).toBe(true);
  });
});

describe("Firefly dev mode denies public reads", { timeout: 15000 }, () => {
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

    // Create a DEV mode app with publicAccess enabled
    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Dev Public</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;

    await ownerApi.putDoc({ appSlug, userSlug, dbName: "default", doc: { title: "dev-seed" }, docId: "dev-doc" });
    await ownerApi.ensureAppSettings({ appSlug, userSlug, publicAccess: { enable: true } });
  });

  it("dev mode: anonymous getDoc denied despite publicAccess", async () => {
    const rRes = await anonApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "dev-doc" });
    expect(rRes.isErr()).toBe(true);
  });

  it("dev mode: anonymous queryDocs denied despite publicAccess", async () => {
    const rRes = await anonApi.queryDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  it("dev mode: anonymous subscribeDocs denied despite publicAccess", async () => {
    const rRes = await anonApi.subscribeDocs({ appSlug, userSlug, dbName: "default" });
    expect(rRes.isErr()).toBe(true);
  });

  it("dev mode: owner can still read their own docs", async () => {
    const rRes = await ownerApi.getDoc({ appSlug, userSlug, dbName: "default", docId: "dev-doc" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });
});
