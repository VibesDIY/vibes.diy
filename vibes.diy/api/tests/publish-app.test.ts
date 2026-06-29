import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// #2772 D2 — publishApp mints a new top-of-stack production release (no demote).
describe("publishApp", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // non-owner
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
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

  // Append a version (new fsId) to an app slug. Returns the row's fsId.
  async function ensureVersion(opts: { appSlug?: string; mode: "dev" | "production"; tag: string }) {
    const rRes = await api.ensureAppSlug({
      ...(opts.appSlug ? { appSlug: opts.appSlug } : {}),
      mode: opts.mode,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>${opts.tag}</div>;} App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail(`Expected ensureAppSlug (${opts.mode}) ok`);
    return res;
  }

  // production baseline + a newer dev draft on the same slug.
  async function publishedThenDraft() {
    const now = sthis.nextId(8).str;
    const prod = await ensureVersion({ mode: "production", tag: `pub ${now}` });
    await ensureVersion({ appSlug: prod.appSlug, mode: "dev", tag: `draft ${now}` });
    return { appSlug: prod.appSlug, ownerHandle: prod.ownerHandle };
  }

  it("publishes the owner's latest dev draft as the new production (no demote)", async () => {
    const { appSlug, ownerHandle } = await publishedThenDraft();

    // The draft's fsId (owner's latest dev) before publish.
    const rDraft = await api.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" });
    const draftFsId = rDraft.Ok().fsId;
    expect(rDraft.Ok().mode).toBe("dev");

    const rPub = await api.publishApp({ appSlug, ownerHandle });
    if (rPub.isErr()) assert.fail("Expected publishApp to succeed: " + JSON.stringify(rPub.Err()));
    expect(rPub.Ok().published).toBe(true);
    expect(rPub.Ok().mode).toBe("production");
    expect(rPub.Ok().fsId).toBe(draftFsId);

    // Default (published) read now serves the formerly-draft content as production.
    const rPublished = await api.getAppByFsId({ appSlug, ownerHandle });
    expect(rPublished.Ok().mode).toBe("production");
    expect(rPublished.Ok().fsId).toBe(draftFsId);

    // ...and the owner's draft indicator clears (ownerLatest now resolves production).
    const rOwner = await api.getAppByFsId({ appSlug, ownerHandle, selectMode: "ownerLatest" });
    expect(rOwner.Ok().mode).toBe("production");
    expect(rOwner.Ok().fsId).toBe(draftFsId);
  });

  it("is an idempotent no-op when the latest is already published (up to date)", async () => {
    const { appSlug, ownerHandle } = await publishedThenDraft();

    const first = await api.publishApp({ appSlug, ownerHandle });
    expect(first.Ok().published).toBe(true);
    const firstSeq = first.Ok().releaseSeq;

    // Second publish with nothing new → no-op success, no duplicate row.
    const second = await api.publishApp({ appSlug, ownerHandle });
    expect(second.Ok().published).toBe(false);
    expect(second.Ok().releaseSeq).toBe(firstSeq);
    expect(second.Ok().fsId).toBe(first.Ok().fsId);
  });

  it("re-releases an explicit OLDER fsId as the new top-of-stack production", async () => {
    // v1 production (fsId A), v2 dev (fsId B). Publish B (top), then publish A by
    // fsId — A must win the unversioned read even though a newer production (B) exists.
    const now = sthis.nextId(8).str;
    const v1 = await ensureVersion({ mode: "production", tag: `v1 ${now}` });
    const { appSlug, ownerHandle } = v1;
    const v1FsId = v1.fsId;
    const v2 = await ensureVersion({ appSlug, mode: "dev", tag: `v2 ${now}` });

    // Publish the latest dev (v2) → it becomes the served production.
    const pubV2 = await api.publishApp({ appSlug, ownerHandle });
    expect(pubV2.Ok().fsId).toBe(v2.fsId);
    expect((await api.getAppByFsId({ appSlug, ownerHandle })).Ok().fsId).toBe(v2.fsId);

    // Now publish the OLDER v1 by fsId — must re-release it at MAX+1 so it wins.
    const pubV1 = await api.publishApp({ appSlug, ownerHandle, fsId: v1FsId });
    if (pubV1.isErr()) assert.fail("Expected publishApp(older fsId) to succeed: " + JSON.stringify(pubV1.Err()));
    expect(pubV1.Ok().published).toBe(true);
    expect(pubV1.Ok().fsId).toBe(v1FsId);

    const served = await api.getAppByFsId({ appSlug, ownerHandle });
    expect(served.Ok().mode).toBe("production");
    expect(served.Ok().fsId).toBe(v1FsId); // older version now wins via a fresh top-of-stack release
    expect(served.Ok().releaseSeq).toBeGreaterThan(pubV2.Ok().releaseSeq);
  });

  it("a non-owner can pull the published fsId even when a dev row shares it (Codex review)", async () => {
    // Publishing mints a production row carrying the dev draft's fsId, leaving the
    // dev row — so one fsId maps to BOTH a dev and a production row. getAppByFsId's
    // exact lookup must prefer the production row, else a non-owner pulling the
    // published fsId binds the dev duplicate and is denied.
    const { appSlug, ownerHandle } = await publishedThenDraft();
    const rPub = await api.publishApp({ appSlug, ownerHandle });
    const publishedFsId = rPub.Ok().fsId;
    await api.ensureAppSettings({ appSlug, ownerHandle, publicAccess: { enable: true } });

    const rApp = await api2.getAppByFsId({ appSlug, ownerHandle, fsId: publishedFsId });
    if (rApp.isErr()) assert.fail("Expected getAppByFsId to succeed: " + JSON.stringify(rApp.Err()));
    const res = rApp.Ok();
    expect(res.mode).toBe("production"); // bound the production row, not the dev duplicate
    expect(res.grant).toBe("public-access"); // pullable, not not-grant
  });

  it("rejects a non-owner publish", async () => {
    const { appSlug, ownerHandle } = await publishedThenDraft();
    const rPub = await api2.publishApp({ appSlug, ownerHandle });
    expect(rPub.isErr()).toBe(true);
  });

  it("converges concurrent publishes of the same draft (atomic mint, no duplicate)", async () => {
    const { appSlug, ownerHandle } = await publishedThenDraft();

    // Two publishes fired together: the atomic insert + idempotency guard means
    // exactly one mints and the other no-ops — they converge on the same fsId.
    const [a, b] = await Promise.all([api.publishApp({ appSlug, ownerHandle }), api.publishApp({ appSlug, ownerHandle })]);
    if (a.isErr() || b.isErr()) assert.fail("Expected both concurrent publishes to succeed");
    expect(a.Ok().fsId).toBe(b.Ok().fsId);
    expect(a.Ok().mode).toBe("production");
    // At most one actually minted a new release (the other is the idempotent no-op).
    expect([a.Ok().published, b.Ok().published].filter(Boolean).length).toBeLessThanOrEqual(1);

    // The served production is that converged fsId.
    const served = await api.getAppByFsId({ appSlug, ownerHandle });
    expect(served.Ok().fsId).toBe(a.Ok().fsId);
  });
});
