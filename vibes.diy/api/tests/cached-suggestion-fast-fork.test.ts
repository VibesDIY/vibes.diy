import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, cachedSuggestionKey } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Fast-fork-from-cache (#2929 item 1). A non-owner clicking an offered chip that
// has a PRODUCED (but unblessed) result gets a fork SEEDED from that result's
// chip-applied code (no codegen) instead of a slow regenerate. forkApp resolves
// the produce map for the supplied `cacheKey` and seeds the fork iff the source
// app is public + not tombstoned AND the entry's source version was public. This
// path serves UNBLESSED code, so it is NOT covered by the bless gate — these
// tests pin exactly when it seeds and when it falls back to a normal fork.
describe(
  "cached-suggestion fast-fork-from-cache",
  { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 },
  () => {
    const sthis = ensureSuperThis();

    let api: VibesDiyApi; // owner (produces)
    let api2: VibesDiyApi; // non-owner (forks)

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

    async function publicAppWithStagedVersion(opts: { makePublic?: boolean } = {}) {
      const makePublic = opts.makePublic ?? true;
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
      if (makePublic) await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

      const rSrc = await api.getAppByFsId({ appSlug, ownerHandle });
      if (rSrc.isErr() || !rSrc.Ok().fsId) assert.fail("could not resolve source fsId");
      const sourceFsId = rSrc.Ok().fsId as string;

      const rStaged = await api.ensureAppSlug({
        appSlug,
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: `function App(){return <div>chip-applied ${now}</div>;} App();`,
          },
        ],
      });
      if (!isResEnsureAppSlugOk(rStaged.Ok())) assert.fail("ensureAppSlug(dev staged) failed");
      const stagedFsId = (await api.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" })).Ok().fsId as string;
      expect(stagedFsId).not.toBe(sourceFsId);

      return { appSlug, ownerHandle, sourceFsId, stagedFsId };
    }

    async function produce(a: { appSlug: string; ownerHandle: string; key: string; fsId: string; sourceFsId: string }) {
      await api.ensureAppSettings({
        appSlug: a.appSlug,
        ownerHandle: a.ownerHandle,
        cachedSuggestion: { key: a.key, fsId: a.fsId, sourceFsId: a.sourceFsId },
      });
    }

    it("seeds the fork from the produced (unblessed) result — no bless needed", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "make it loud" });
      // Owner PRODUCES only (no bless).
      await produce({ appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });

      const rFork = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      if (rFork.isErr()) assert.fail("forkApp failed: " + JSON.stringify(rFork.Err()));
      const fork = rFork.Ok();
      // Seeded from the produced result: the chip-applied dev fsId, NOT the source.
      expect(fork.seededFromCache).toBe(true);
      expect(fork.srcFsId).toBe(stagedFsId);
      expect(fork.ownerHandle).not.toBe(ownerHandle); // landed in the forker's namespace
    });

    it("falls back to a normal fork when there is NO produced entry for the key", async () => {
      const { appSlug, ownerHandle, sourceFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "never produced" });

      const rFork = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      if (rFork.isErr()) assert.fail("forkApp failed: " + JSON.stringify(rFork.Err()));
      const fork = rFork.Ok();
      expect(fork.seededFromCache).toBeFalsy();
      // Forked from the requested (public) source version, not a seed.
      expect(fork.srcFsId).toBe(sourceFsId);
    });

    it("does NOT seed from a produced result whose SOURCE was not public", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      // Produce with a bogus sourceFsId that has no production row → source-not-public.
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: "z-not-a-real-prod" }, transform: "bad source" });
      await produce({ appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod" });

      const rFork = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      if (rFork.isErr()) assert.fail("forkApp failed: " + JSON.stringify(rFork.Err()));
      expect(rFork.Ok().seededFromCache).toBeFalsy();
      expect(rFork.Ok().srcFsId).toBe(sourceFsId);
    });

    it("does NOT seed from a produced result when the app is NOT public", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion({ makePublic: false });
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "private app" });
      await produce({ appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });

      // The app is not public, so even a produced entry can't seed a non-owner fork —
      // and the normal grant denies the fork outright (not-grant).
      const rFork = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      expect(rFork.isErr()).toBe(true);
    });

    it("stops seeding after the app is unpublished (tombstone)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "tombstone fork" });
      await produce({ appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });

      // Served before unpublish.
      const rBefore = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      if (rBefore.isErr()) assert.fail("forkApp(before) failed: " + JSON.stringify(rBefore.Err()));
      expect(rBefore.Ok().seededFromCache).toBe(true);

      const rUn = await api.setUnpublish({ ownerHandle, appSlug, unpublish: true });
      if (rUn.isErr()) assert.fail("setUnpublish failed: " + JSON.stringify(rUn.Err()));

      // After unpublish the tombstone gate stops the seed (and the bare-slug fork).
      const rAfter = await api2.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: sourceFsId, cacheKey: key });
      // Explicit-fsId forks of a public production version still resolve, but they
      // must NOT be cache-seeded once tombstoned.
      if (rAfter.isOk()) {
        expect(rAfter.Ok().seededFromCache).toBeFalsy();
      }
    });
  }
);
