import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { and, eq } from "drizzle-orm/sql/expressions";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// #2688 — soft unpublish (tombstone) hides a slug from non-owner no-fsId
// resolution (serve / no-srcFsId remix / non-owner listVersions) while keeping
// explicit-fsId reads and owner reads intact, and is fully reversible.
describe("setUnpublish", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 8000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // non-owner
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 1500 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();
    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: { connections: new Set(), webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }) },
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
    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 1600 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  // Create a public production app owned by `api` that a non-owner can resolve.
  async function publicProdApp(tag: string) {
    const rRes = await api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>${tag}</div>;} App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail(`Expected ensureAppSlug (production) ok for ${tag}`);
    const rSet = await api.ensureAppSettings({
      appSlug: res.appSlug,
      ownerHandle: res.ownerHandle,
      publicAccess: { enable: true },
    });
    if (rSet.isErr()) assert.fail(`ensureAppSettings failed: ${rSet.Err().message}`);
    return { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId };
  }

  it("owner round-trips unpublish/republish and gets an ISO timestamp then empty", async () => {
    const app = await publicProdApp(`roundtrip ${sthis.nextId(6).str}`);

    const rUnpub = await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });
    if (rUnpub.isErr()) assert.fail(rUnpub.Err().message);
    expect(rUnpub.Ok().unpublishedAt.length).toBeGreaterThan(0);

    const rRepub = await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: false });
    if (rRepub.isErr()) assert.fail(rRepub.Err().message);
    expect(rRepub.Ok().unpublishedAt).toBe("");
  });

  it("hides the no-fsId public serve from a non-owner, but keeps explicit-fsId and owner reads", async () => {
    const app = await publicProdApp(`serve ${sthis.nextId(6).str}`);

    // Pre-unpublish: non-owner resolves the bare slug.
    const before = await api2.getAppByFsId({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(before.Ok().grant).toBe("public-access");

    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });

    // Non-owner no-fsId → not-found.
    const after = await api2.getAppByFsId({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(after.Ok().grant).toBe("not-found");

    // Non-owner explicit fsId → still resolves (permalinks / remix lineage survive).
    const byFsId = await api2.getAppByFsId({ appSlug: app.appSlug, ownerHandle: app.ownerHandle, fsId: app.fsId });
    expect(byFsId.Ok().grant).toBe("public-access");

    // Owner no-fsId → still resolves (sees through the tombstone).
    const owner = await api.getAppByFsId({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(owner.Ok().grant).toBe("owner");

    // Republish restores non-owner no-fsId resolution exactly.
    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: false });
    const restored = await api2.getAppByFsId({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(restored.Ok().grant).toBe("public-access");
  });

  it("hides versions from a non-owner when unpublished, owner still sees full history", async () => {
    const app = await publicProdApp(`versions ${sthis.nextId(6).str}`);

    const nonOwnerBefore = await api2.listVersions({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(nonOwnerBefore.Ok().items.length).toBeGreaterThan(0);

    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });

    const nonOwnerAfter = await api2.listVersions({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(nonOwnerAfter.Ok().items.length).toBe(0);

    const ownerAfter = await api.listVersions({ appSlug: app.appSlug, ownerHandle: app.ownerHandle });
    expect(ownerAfter.Ok().items.length).toBeGreaterThan(0);
  });

  it("blocks a non-owner no-srcFsId remix when unpublished, but allows explicit-srcFsId remix", async () => {
    const app = await publicProdApp(`remix ${sthis.nextId(6).str}`);

    // Sanity: a public app can be remixed by a non-owner before unpublish.
    const okFork = await api2.forkApp({ srcUserSlug: app.ownerHandle, srcAppSlug: app.appSlug });
    if (okFork.isErr()) assert.fail(`expected pre-unpublish fork to succeed: ${okFork.Err().message}`);

    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });

    // No-srcFsId remix → app-not-found (the slug is tombstoned).
    const blocked = await api2.forkApp({ srcUserSlug: app.ownerHandle, srcAppSlug: app.appSlug });
    expect(blocked.isErr()).toBe(true);

    // Explicit-srcFsId remix → still works (lineage to a specific version survives).
    const byFsId = await api2.forkApp({ srcUserSlug: app.ownerHandle, srcAppSlug: app.appSlug, srcFsId: app.fsId });
    if (byFsId.isErr()) assert.fail(`expected explicit-srcFsId fork to survive unpublish: ${byFsId.Err().message}`);
  });

  it("surfaces the unpublishedAt marker in the owner's own recent-vibes list, cleared on republish", async () => {
    const app = await publicProdApp(`list ${sthis.nextId(6).str}`);

    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });
    const listed = await api.listRecentVibes({ limit: 100 });
    if (listed.isErr()) assert.fail(listed.Err().message);
    const marked = listed.Ok().items.find((it) => it.appSlug === app.appSlug && it.ownerHandle === app.ownerHandle);
    expect(marked).toBeDefined();
    expect(marked?.unpublishedAt && marked.unpublishedAt.length > 0).toBe(true);

    await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: false });
    const listed2 = await api.listRecentVibes({ limit: 100 });
    const cleared = listed2.Ok().items.find((it) => it.appSlug === app.appSlug && it.ownerHandle === app.ownerHandle);
    expect(cleared).toBeDefined();
    expect(cleared?.unpublishedAt).toBeFalsy();
  });

  it("rejects unpublish on an app owned by another user", async () => {
    const app = await publicProdApp(`not-yours ${sthis.nextId(6).str}`);
    const r = await api2.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: app.appSlug, unpublish: true });
    expect(r.isErr()).toBe(true);
  });

  it("rejects unpublish of a nonexistent slug without creating a binding", async () => {
    // Resolve the caller's own handle by creating a real app first.
    const app = await publicProdApp(`missing ${sthis.nextId(6).str}`);
    const missingSlug = `missing-unpublish-${sthis.nextId(6).str}`;

    const r = await api.setUnpublish({ ownerHandle: app.ownerHandle, appSlug: missingSlug, unpublish: true });
    expect(r.isErr()).toBe(true);

    // The typo'd slug must NOT have minted a stray AppSlugBindings row.
    const asb = appCtx.vibesCtx.sql.tables.appSlugBinding;
    const row = await appCtx.vibesCtx.sql.db
      .select({ appSlug: asb.appSlug })
      .from(asb)
      .where(and(eq(asb.ownerHandle, app.ownerHandle), eq(asb.appSlug, missingSlug)))
      .limit(1)
      .then((rows) => rows[0]);
    expect(row).toBeUndefined();
  });
});
