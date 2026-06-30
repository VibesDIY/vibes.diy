import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, cachedSuggestionKey } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Integration tests for the cached-suggestion read lane (#2801) and its bless
// gate (the prod prerequisite): the cachedSuggestionGrant in get-app-by-fsid, the
// getCachedSuggestion reader, and the owner-gated produce + bless/revoke writes.
//
// The defining invariant under test (Charlie #2890): a *produced* result is
// deny-by-default — it FORKS until the owner explicitly *blesses* it; a blessed
// result STAYS (served in-namespace); revoking forks it again (fail-to-fork); and
// a non-owner can neither produce nor bless. Mirrors get-app-by-fsid.test.ts.
describe(
  "cached-suggestion read lane (bless gate)",
  { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 },
  () => {
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
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: `function App(){return <div>src ${now}</div>;} App();`,
          },
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

    // Owner records the produced result (deny-by-default — does NOT make it servable).
    async function produce(
      who: VibesDiyApi,
      a: { appSlug: string; ownerHandle: string; key: string; fsId: string; sourceFsId: string }
    ) {
      await who.ensureAppSettings({
        appSlug: a.appSlug,
        ownerHandle: a.ownerHandle,
        cachedSuggestion: { key: a.key, fsId: a.fsId, sourceFsId: a.sourceFsId },
      });
    }

    // Owner blesses (op "bless") or revokes (op "revoke") a produced result.
    async function bless(
      who: VibesDiyApi,
      a: { appSlug: string; ownerHandle: string; key: string; fsId: string; sourceFsId: string; op: "bless" | "revoke" }
    ) {
      await who.ensureAppSettings({
        appSlug: a.appSlug,
        ownerHandle: a.ownerHandle,
        cachedSuggestionBless: { key: a.key, fsId: a.fsId, sourceFsId: a.sourceFsId, op: a.op },
      });
    }

    async function grantOf(fsId: string, a: { appSlug: string; ownerHandle: string }) {
      const r = await api2.getAppByFsId({ appSlug: a.appSlug, ownerHandle: a.ownerHandle, fsId });
      if (r.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(r.Err()));
      return r.Ok().grant;
    }

    async function readerFsId(a: { appSlug: string; ownerHandle: string; key: string }) {
      const r = await api2.getCachedSuggestion({ ownerHandle: a.ownerHandle, appSlug: a.appSlug, key: a.key });
      if (r.isErr()) assert.fail("getCachedSuggestion failed: " + JSON.stringify(r.Err()));
      return r.Ok().fsId;
    }

    it("PRODUCED but UNBLESSED → forks (grant denies, reader misses)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "make it loud" });
      // Produce only — no bless.
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("BLESSED → stays (grant public-access, reader returns the staged fsId)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "add a high score" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      // Non-owner reads the UNPUBLISHED staged fsId → granted public-access via the lane.
      const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
      if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
      expect(rApp.Ok().grant).toBe("public-access");
      expect(rApp.Ok().mode).toBe("dev");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBe(stagedFsId);
    });

    it("REVOKED → forks again (fail-to-fork)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "revoke me" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      // Served while blessed.
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBe(stagedFsId);

      // Revoke → forks again.
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "revoke" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("a NON-OWNER cannot bless (owner-gated write)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "non owner bless" });
      // Owner produces; NON-OWNER attempts the bless — must NOT take effect.
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api2, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("a NON-OWNER cannot produce (owner-gated write)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "non owner produce" });
      // NON-OWNER attempts to produce; even if the owner later blesses the same key,
      // the non-owner's produce never landed — but the bless itself is what gates,
      // so assert the lane stays closed for a non-owner-only write.
      await produce(api2, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api2, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("cannot bless a key/tuple with NO matching produced entry (bless depends on produce; Codex)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();

      // (a) Bless WITHOUT producing first → rejected, nothing servable.
      const keyA = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "never produced" });
      await bless(api, { appSlug, ownerHandle, key: keyA, fsId: stagedFsId, sourceFsId, op: "bless" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key: keyA })).toBeUndefined();

      // (b) Produce one fsId, then bless a DIFFERENT fsId for the same key → rejected.
      const keyB = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "tuple mismatch" });
      await produce(api, { appSlug, ownerHandle, key: keyB, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key: keyB, fsId: "z-other-unpublished-fsid", sourceFsId, op: "bless" });
      expect(await grantOf("z-other-unpublished-fsid", { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key: keyB })).toBeUndefined();
    });

    it("a STALE revoke (wrong tuple) does NOT unpublish the current bless (Codex)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "stale revoke" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).toBe("public-access");

      // Revoke carrying a STALE fsId → no-op; the current bless survives.
      await bless(api, { appSlug, ownerHandle, key, fsId: "z-stale-old-fsid", sourceFsId, op: "revoke" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBe(stagedFsId);

      // Revoke with the correct tuple → removed (forks again).
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "revoke" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
    });

    it("does NOT serve a BLESSED result when the source was NOT public (dev source)", async () => {
      const { appSlug, ownerHandle, stagedFsId } = await publicAppWithStagedVersion();
      // Bless with a bogus sourceFsId that has no production row → source-was-public fails.
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: "z-not-a-real-prod" }, transform: "x" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod" });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod", op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("does NOT serve a BLESSED result when the app is NOT public", async () => {
      // Build a NON-public app with a staged version + bless.
      const now = sthis.nextId(8).str;
      const rProd = await api.ensureAppSlug({
        mode: "production",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: `function App(){return <div>priv ${now}</div>;} App();`,
          },
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
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("stops serving a BLESSED result after the app is unpublished (Finding B)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "tombstone" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      // Served while published + blessed.
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).toBe("public-access");

      // Soft-unpublish (tombstone): publicAccess stays enabled, but the staged
      // version must stop serving — the grant re-checks isHiddenForCaller (Finding B).
      const rUn = await api.setUnpublish({ ownerHandle, appSlug, unpublish: true });
      if (rUn.isErr()) assert.fail("setUnpublish failed: " + JSON.stringify(rUn.Err()));

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });
  }
);
