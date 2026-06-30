import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, cachedSuggestionKey } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Integration tests for the cached-suggestion read lane (#2801): the
// cachedSuggestionGrant in get-app-by-fsid, the getCachedSuggestion reader, and
// the owner-gated write. Mirrors get-app-by-fsid.test.ts's harness.
describe("cached-suggestion read lane", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // non-owner visitor

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
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

  // A public production app (the source) + a distinct dev version (the staged
  // result). Returns the slug + the source (production) fsId + the staged (dev) fsId.
  async function publicAppWithStagedVersion() {
    const now = sthis.nextId(8).str;
    const rProd = await api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>src ${now}</div>;} App();` },
      ],
    });
    const prod = rProd.Ok();
    if (!isResEnsureAppSlugOk(prod)) assert.fail("ensureAppSlug(production) failed");
    const { appSlug, ownerHandle } = prod;
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const rSrc = await api.getAppByFsId({ appSlug, ownerHandle });
    if (rSrc.isErr() || !rSrc.Ok().fsId) assert.fail("could not resolve source fsId");
    const sourceFsId = rSrc.Ok().fsId as string;

    // A distinct dev version on the same slug — the "staged result".
    const rStaged = await api.ensureAppSlug({
      appSlug,
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App(){return <div>staged ${now}</div>;} App();`,
        },
      ],
    });
    if (!isResEnsureAppSlugOk(rStaged.Ok())) assert.fail("ensureAppSlug(dev staged) failed");
    const rStagedRead = await api.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" });
    if (rStagedRead.isErr() || !rStagedRead.Ok().fsId) assert.fail("could not resolve staged fsId");
    const stagedFsId = rStagedRead.Ok().fsId as string;
    expect(stagedFsId).not.toBe(sourceFsId);
    expect(rStagedRead.Ok().mode).toBe("dev"); // staged stays unpublished

    return { appSlug, ownerHandle, sourceFsId, stagedFsId };
  }

  it("serves a registered staged version anonymously when the source was public (cachedSuggestionGrant)", async () => {
    const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "make it loud" });
    await api.ensureAppSettings({ appSlug, ownerHandle, cachedSuggestion: { key, fsId: stagedFsId, sourceFsId } });

    // Non-owner reads the UNPUBLISHED staged fsId → granted public-access via the lane.
    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).toBe("public-access");
    expect(rApp.Ok().mode).toBe("dev");
  });

  it("does NOT serve an UNREGISTERED staged version to a non-owner", async () => {
    const { appSlug, ownerHandle, stagedFsId } = await publicAppWithStagedVersion();
    // No cached-suggestion entry registered.
    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).not.toBe("public-access");
  });

  it("does NOT serve a registered staged version when the source was NOT public (dev source)", async () => {
    const { appSlug, ownerHandle, stagedFsId } = await publicAppWithStagedVersion();
    // Register with a bogus sourceFsId that has no production row → source-was-public fails.
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: "z-not-a-real-prod" }, transform: "x" });
    await api.ensureAppSettings({
      appSlug,
      ownerHandle,
      cachedSuggestion: { key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod" },
    });

    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).not.toBe("public-access");
  });

  it("getCachedSuggestion returns the staged fsId on a hit, and a miss otherwise", async () => {
    const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "add a high score" });
    await api.ensureAppSettings({ appSlug, ownerHandle, cachedSuggestion: { key, fsId: stagedFsId, sourceFsId } });

    // Hit (non-owner / public app).
    const rHit = await api2.getCachedSuggestion({ ownerHandle, appSlug, key });
    if (rHit.isErr()) assert.fail("getCachedSuggestion failed: " + JSON.stringify(rHit.Err()));
    expect(rHit.Ok().fsId).toBe(stagedFsId);

    // Miss: unknown key → fsId absent (no oracle).
    const rMiss = await api2.getCachedSuggestion({ ownerHandle, appSlug, key: "cf-unknown-key" });
    if (rMiss.isErr()) assert.fail("getCachedSuggestion(miss) failed: " + JSON.stringify(rMiss.Err()));
    expect(rMiss.Ok().fsId).toBeUndefined();
  });

  it("a NON-OWNER cannot register a cached suggestion (owner-gated write)", async () => {
    const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "non owner attempt" });

    // Non-owner attempts the write; it must NOT take effect.
    await api2.ensureAppSettings({ appSlug, ownerHandle, cachedSuggestion: { key, fsId: stagedFsId, sourceFsId } });

    // The reader still misses, and the grant still refuses to serve the staged fsId.
    const rRead = await api2.getCachedSuggestion({ ownerHandle, appSlug, key });
    if (rRead.isErr()) assert.fail("getCachedSuggestion failed: " + JSON.stringify(rRead.Err()));
    expect(rRead.Ok().fsId).toBeUndefined();

    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).not.toBe("public-access");
  });

  it("does NOT serve a registered staged version when the app is NOT public", async () => {
    // Build a NON-public app with a staged version + registration.
    const now = sthis.nextId(8).str;
    const rProd = await api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>priv ${now}</div>;} App();` },
      ],
    });
    if (!isResEnsureAppSlugOk(rProd.Ok())) assert.fail("ensureAppSlug failed");
    const { appSlug, ownerHandle } = rProd.Ok() as { appSlug: string; ownerHandle: string };
    const rSrc = await api.getAppByFsId({ appSlug, ownerHandle });
    const sourceFsId = rSrc.Ok().fsId as string;
    const rStaged = await api.ensureAppSlug({
      appSlug,
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App(){return <div>privstg ${now}</div>;} App();`,
        },
      ],
    });
    if (!isResEnsureAppSlugOk(rStaged.Ok())) assert.fail("ensureAppSlug(dev) failed");
    const stagedFsId = (await api.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" })).Ok().fsId as string;
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "private" });
    // publicAccess is NOT enabled.
    await api.ensureAppSettings({ appSlug, ownerHandle, cachedSuggestion: { key, fsId: stagedFsId, sourceFsId } });

    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).not.toBe("public-access");

    const rRead = await api2.getCachedSuggestion({ ownerHandle, appSlug, key });
    if (rRead.isErr()) assert.fail("getCachedSuggestion failed: " + JSON.stringify(rRead.Err()));
    expect(rRead.Ok().fsId).toBeUndefined();
  });

  it("stops serving a registered staged version after the app is unpublished (Finding B)", async () => {
    const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
    const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "tombstone" });
    await api.ensureAppSettings({ appSlug, ownerHandle, cachedSuggestion: { key, fsId: stagedFsId, sourceFsId } });

    // Served while published.
    expect((await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId })).Ok().grant).toBe("public-access");

    // Soft-unpublish (tombstone): publicAccess stays enabled, but the staged
    // version must stop serving — the grant re-checks isHiddenForCaller (Finding B).
    const rUn = await api.setUnpublish({ ownerHandle, appSlug, unpublish: true });
    if (rUn.isErr()) assert.fail("setUnpublish failed: " + JSON.stringify(rUn.Err()));

    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
    if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
    expect(rApp.Ok().grant).not.toBe("public-access");

    const rRead = await api2.getCachedSuggestion({ ownerHandle, appSlug, key });
    if (rRead.isErr()) assert.fail("getCachedSuggestion failed: " + JSON.stringify(rRead.Err()));
    expect(rRead.Ok().fsId).toBeUndefined();
  });
});
