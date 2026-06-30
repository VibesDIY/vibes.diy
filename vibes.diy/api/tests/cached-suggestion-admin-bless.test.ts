import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, cachedSuggestionKey } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Admin-on-behalf blessing (#2929 item 3). The bless write is owner-gated, but an
// allowlisted platform admin (VIBES_ADMIN_USER_IDS) may pass that gate for a
// SINGLE request type — a cached-suggestion bless/revoke — on an app they do NOT
// own. This is the curation seam: admins featuring other owners' already-public,
// owner-PRODUCED chip results.
//
// The invariants are unchanged from the owner path and re-asserted here for the
// admin: produce-before-bless + tuple match (an admin can only bless what the
// OWNER produced — the produce map is owner-write-only), source-was-public, and
// app-public. The gate is bless-only: an admin canNOT mutate any other setting.
// An empty allowlist (the default) makes the whole capability inert.
describe(
  "cached-suggestion admin-on-behalf bless",
  { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 },
  () => {
    const sthis = ensureSuperThis();

    // Deterministic admin identity so we can put its verified userId in the
    // allowlist BEFORE it makes a request. createTestUser mints
    // `user-id-${session}-${seqUserId}`; with an explicit session the id is fixed.
    const ADMIN_SESSION = "admin-on-behalf-session";
    const ADMIN_SEQ = 500;
    const ADMIN_USER_ID = `user-id-${ADMIN_SESSION}-${ADMIN_SEQ}`;

    let api: VibesDiyApi; // owner (produces)
    let api2: VibesDiyApi; // plain non-owner (NOT an admin)
    let api3: VibesDiyApi; // platform admin (blesses on behalf)

    beforeAll(async () => {
      const deviceCA = await createTestDeviceCA(sthis);
      const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
      // Populate the admin allowlist on the shared sthis env. The handler reads
      // `VIBES_ADMIN_USER_IDS` at request time, so setting it here (after ctx
      // creation, before any admin request) takes effect.
      sthis.env.set("VIBES_ADMIN_USER_IDS", `someone-else, ${ADMIN_USER_ID} ,another`);

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

      const adminUser = await createTestUser({ sthis, deviceCA, session: ADMIN_SESSION, seqUserId: ADMIN_SEQ });
      api3 = new VibesDiyApi({
        apiUrl: "http://localhost:8787/api",
        ws: wsPair.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 100000,
        getToken: async () => Result.Ok(await adminUser.getDashBoardToken()),
      });
    });

    // A public production app (the source) + a distinct dev version (the staged result).
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

      return { appSlug, ownerHandle, sourceFsId, stagedFsId };
    }

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

    // The owner's view of the bless map (to inspect approvedBy).
    async function blessApprovedBy(a: { appSlug: string; ownerHandle: string; key: string }) {
      const r = await api.ensureAppSettings({ appSlug: a.appSlug, ownerHandle: a.ownerHandle });
      if (r.isErr()) assert.fail("ensureAppSettings(read) failed: " + JSON.stringify(r.Err()));
      return r.Ok().settings.entry.cachedSuggestionBlesses?.[a.key]?.approvedBy;
    }

    it("ADMIN blesses an owner's produced result on-behalf → it stays (approvedBy = admin)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "admin features this" });
      // OWNER produces (deny-by-default); ADMIN blesses on-behalf.
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api3, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      // Now anonymously served as an in-namespace stay.
      const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: stagedFsId });
      if (rApp.isErr()) assert.fail("getAppByFsId failed: " + JSON.stringify(rApp.Err()));
      expect(rApp.Ok().grant).toBe("public-access");
      expect(rApp.Ok().mode).toBe("dev");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBe(stagedFsId);
      // The audit field records the ADMIN as approver, not the owner.
      expect(await blessApprovedBy({ appSlug, ownerHandle, key })).toBe(ADMIN_USER_ID);
    });

    it("ADMIN can revoke its own on-behalf bless → forks again (fail-to-fork)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "admin revokes" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      await bless(api3, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).toBe("public-access");

      await bless(api3, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "revoke" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("ADMIN bless still requires produce-before-bless + tuple match", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();

      // (a) Admin blesses WITHOUT the owner producing first → rejected.
      const keyA = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "admin never produced" });
      await bless(api3, { appSlug, ownerHandle, key: keyA, fsId: stagedFsId, sourceFsId, op: "bless" });
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key: keyA })).toBeUndefined();

      // (b) Owner produces one fsId; admin blesses a DIFFERENT fsId for the key → rejected.
      const keyB = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "admin tuple mismatch" });
      await produce(api, { appSlug, ownerHandle, key: keyB, fsId: stagedFsId, sourceFsId });
      await bless(api3, { appSlug, ownerHandle, key: keyB, fsId: "z-admin-other-fsid", sourceFsId, op: "bless" });
      expect(await grantOf("z-admin-other-fsid", { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key: keyB })).toBeUndefined();
    });

    it("ADMIN bless does NOT serve when the source was not public", async () => {
      const { appSlug, ownerHandle, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({
        source: { ownerHandle, appSlug, fsId: "z-not-a-real-prod" },
        transform: "admin bad source",
      });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod" });
      await bless(api3, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId: "z-not-a-real-prod", op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("a NON-admin non-owner still cannot bless (allowlist gates)", async () => {
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "non admin bless" });
      await produce(api, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId });
      // api2 is a verified user but NOT in the allowlist.
      await bless(api2, { appSlug, ownerHandle, key, fsId: stagedFsId, sourceFsId, op: "bless" });

      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });

    it("the admin gate is bless-ONLY — an admin cannot mutate other settings on a foreign app", async () => {
      const { appSlug, ownerHandle } = await publicAppWithStagedVersion();
      // Admin tries to set the title on an app they don't own → must be a read-only
      // no-op (only a cached-suggestion bless passes the gate).
      await api3.ensureAppSettings({ appSlug, ownerHandle, title: "admin-hijacked-title" });
      const rOwner = await api.ensureAppSettings({ appSlug, ownerHandle });
      if (rOwner.isErr()) assert.fail("ensureAppSettings(read) failed: " + JSON.stringify(rOwner.Err()));
      expect(rOwner.Ok().settings.entry.settings.title).not.toBe("admin-hijacked-title");
    });

    it("a COMBINED admin request (bless + produce + title) only blesses — extra fields are inert (Codex P1)", async () => {
      // ArkType objects allow extra keys and the owner mutation switch is
      // first-match, so a request that co-submits `cachedSuggestion` (produce) /
      // `title` alongside a valid `cachedSuggestionBless` must NOT mutate those —
      // otherwise an admin could seed the produce map then bless it, defeating the
      // "admin can only bless what the OWNER produced" bound.
      const { appSlug, ownerHandle, sourceFsId, stagedFsId } = await publicAppWithStagedVersion();
      const key = cachedSuggestionKey({ source: { ownerHandle, appSlug, fsId: sourceFsId }, transform: "combined payload" });

      // Owner has produced NOTHING. Admin sends one request carrying ALL three
      // fields. Sent via a structural cast since the typed client only models a
      // single mutation per request (the server must defend regardless).
      const combined = {
        appSlug,
        ownerHandle,
        cachedSuggestion: { key, fsId: stagedFsId, sourceFsId },
        title: "admin-combined-hijack",
        cachedSuggestionBless: { key, fsId: stagedFsId, sourceFsId, op: "bless" as const },
      };
      await api3.ensureAppSettings(combined as unknown as Parameters<typeof api3.ensureAppSettings>[0]);

      const rOwner = await api.ensureAppSettings({ appSlug, ownerHandle });
      if (rOwner.isErr()) assert.fail("ensureAppSettings(read) failed: " + JSON.stringify(rOwner.Err()));
      const owned = rOwner.Ok().settings.entry;
      // The admin neither seeded the produce map nor changed the title…
      expect(owned.cachedSuggestions?.[key]).toBeUndefined();
      expect(owned.settings.title).not.toBe("admin-combined-hijack");
      // …and the bless itself was rejected (no matching produced entry), so nothing serves.
      expect(owned.cachedSuggestionBlesses?.[key]).toBeUndefined();
      expect(await grantOf(stagedFsId, { appSlug, ownerHandle })).not.toBe("public-access");
      expect(await readerFsId({ appSlug, ownerHandle, key })).toBeUndefined();
    });
  }
);
