import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("Firefly app-documents", { timeout: 10000 }, () => {
  const sthis = ensureSuperThis();
  let api: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    // Create an app to get a valid appSlug and userSlug
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      throw new Error("Failed to create app for test");
    }
    appSlug = res.appSlug;
    userSlug = res.userSlug;
  });

  it("putDoc creates a document and returns id", async () => {
    const rRes = await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "hello" } });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect(res.status).toBe("ok");
    expect(res.id).toBeDefined();
  });

  it("putDoc with explicit docId uses that id", async () => {
    const rRes = await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "explicit" }, docId: "my-doc-id" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().id).toBe("my-doc-id");
  });

  it("getDoc retrieves latest revision", async () => {
    const putRes = await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "getme" }, docId: "get-test" });
    expect(putRes.isOk()).toBe(true);

    const rRes = await api.getDoc({ userSlug, appSlug, dbName: "test", docId: "get-test" });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect(res.status).toBe("ok");
    expect(res.id).toBe("get-test");
    expect((res as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ title: "getme" }));
  });

  it("putDoc same docId increments seq, latest wins", async () => {
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "v1" }, docId: "seq-test" });
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "v2" }, docId: "seq-test" });

    const rRes = await api.getDoc({ userSlug, appSlug, dbName: "test", docId: "seq-test" });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect((res as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ title: "v2" }));
  });

  it("getDoc returns not-found for missing doc", async () => {
    const rRes = await api.getDoc({ userSlug, appSlug, dbName: "test", docId: "nonexistent" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("not-found");
  });

  it("deleteDoc inserts tombstone", async () => {
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "delete-me" }, docId: "del-test" });
    const rRes = await api.deleteDoc({ userSlug, appSlug, dbName: "test", docId: "del-test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("getDoc returns not-found for deleted doc", async () => {
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "soon-gone" }, docId: "del-get-test" });
    await api.deleteDoc({ userSlug, appSlug, dbName: "test", docId: "del-get-test" });

    const rRes = await api.getDoc({ userSlug, appSlug, dbName: "test", docId: "del-get-test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("not-found");
  });

  it("queryDocs returns all non-deleted docs", async () => {
    // Create fresh docs with unique IDs
    const prefix = sthis.nextId(4).str;
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "one" }, docId: `${prefix}-1` });
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "two" }, docId: `${prefix}-2` });
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "three" }, docId: `${prefix}-3` });

    const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    const prefixDocs = docs.filter((d) => d._id.startsWith(prefix));
    expect(prefixDocs).toHaveLength(3);
  });

  it("queryDocs deduplicates by latest seq", async () => {
    const docId = `dedup-${sthis.nextId(4).str}`;
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "v1" }, docId });
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "v2" }, docId });

    const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    const matching = docs.filter((d) => d._id === docId);
    expect(matching).toHaveLength(1);
    expect(matching[0].title).toBe("v2");
  });

  it("queryDocs excludes deleted docs", async () => {
    const docId = `excl-${sthis.nextId(4).str}`;
    await api.putDoc({ userSlug, appSlug, dbName: "test", doc: { title: "gone" }, docId });
    await api.deleteDoc({ userSlug, appSlug, dbName: "test", docId });

    const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    expect(docs.find((d) => d._id === docId)).toBeUndefined();
  });

  it("subscribeDocs returns ok", async () => {
    const rRes = await api.subscribeDocs({ userSlug, appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });
});

describe("Firefly cross-user document isolation", { timeout: 10000 }, () => {
  const sthis = ensureSuperThis();
  let apiA: VibesDiyApi;
  let apiB: VibesDiyApi;
  const sharedAppSlug = "same-slug-isolation-test";
  let userSlugA: string;
  let userSlugB: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    // User A
    const testUserA = await createTestUser({ sthis, deviceCA, seqUserId: 100 });
    const wsPairA = TestWSPair.create();
    const wsEventoA = vibesMsgEvento();
    const wsSendProviderA = new WSSendProvider(wsPairA.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProviderA);
    wsPairA.p2.onmessage = (event: MessageEvent) => {
      wsEventoA.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProviderA });
    };
    apiA = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPairA.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await testUserA.getDashBoardToken()),
    });

    // User B
    const testUserB = await createTestUser({ sthis, deviceCA, seqUserId: 200 });
    const wsPairB = TestWSPair.create();
    const wsEventoB = vibesMsgEvento();
    const wsSendProviderB = new WSSendProvider(wsPairB.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProviderB);
    wsPairB.p2.onmessage = (event: MessageEvent) => {
      wsEventoB.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProviderB });
    };
    apiB = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPairB.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await testUserB.getDashBoardToken()),
    });

    // Both users create apps with the SAME appSlug — this is the exact collision scenario
    const rResA = await apiA.ensureAppSlug({
      appSlug: sharedAppSlug,
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>A</div>; } App();` },
      ],
    });
    const resA = rResA.Ok();
    if (!isResEnsureAppSlugOk(resA)) throw new Error("Failed to create app A");
    userSlugA = resA.userSlug;

    const rResB = await apiB.ensureAppSlug({
      appSlug: sharedAppSlug,
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>B</div>; } App();` },
      ],
    });
    const resB = rResB.Ok();
    if (!isResEnsureAppSlugOk(resB)) throw new Error("Failed to create app B");
    userSlugB = resB.userSlug;
  });

  it("two users with same docId see only their own data", async () => {
    const docId = "shared-doc-id";

    // User A writes
    const rPutA = await apiA.putDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", doc: { owner: "A" }, docId });
    expect(rPutA.isOk()).toBe(true);

    // User B writes same docId
    const rPutB = await apiB.putDoc({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test", doc: { owner: "B" }, docId });
    expect(rPutB.isOk()).toBe(true);

    // User A reads — should see their own
    const rGetA = await apiA.getDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", docId });
    expect(rGetA.isOk()).toBe(true);
    const resA = rGetA.Ok();
    expect(resA.status).toBe("ok");
    expect((resA as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ owner: "A" }));

    // User B reads — should see their own
    const rGetB = await apiB.getDoc({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test", docId });
    expect(rGetB.isOk()).toBe(true);
    const resB = rGetB.Ok();
    expect(resB.status).toBe("ok");
    expect((resB as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ owner: "B" }));
  });

  it("queryDocs only returns docs for the querying user", async () => {
    const prefix = sthis.nextId(4).str;
    await apiA.putDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", doc: { v: "a1" }, docId: `${prefix}-a1` });
    await apiB.putDoc({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test", doc: { v: "b1" }, docId: `${prefix}-b1` });

    const rQueryA = await apiA.queryDocs({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test" });
    expect(rQueryA.isOk()).toBe(true);
    const docsA = rQueryA.Ok().docs;
    expect(docsA.find((d) => d._id === `${prefix}-a1`)).toBeDefined();
    expect(docsA.find((d) => d._id === `${prefix}-b1`)).toBeUndefined();

    const rQueryB = await apiB.queryDocs({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test" });
    expect(rQueryB.isOk()).toBe(true);
    const docsB = rQueryB.Ok().docs;
    expect(docsB.find((d) => d._id === `${prefix}-b1`)).toBeDefined();
    expect(docsB.find((d) => d._id === `${prefix}-a1`)).toBeUndefined();
  });

  it("deleteDoc by one user does not affect another user", async () => {
    const docId = `del-isolation-${sthis.nextId(4).str}`;

    await apiA.putDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", doc: { v: "a" }, docId });
    await apiB.putDoc({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test", doc: { v: "b" }, docId });

    // User A deletes
    await apiA.deleteDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", docId });

    // User A sees not-found
    const rGetA = await apiA.getDoc({ userSlug: userSlugA, appSlug: sharedAppSlug, dbName: "test", docId });
    expect(rGetA.Ok().status).toBe("not-found");

    // User B still sees their doc
    const rGetB = await apiB.getDoc({ userSlug: userSlugB, appSlug: sharedAppSlug, dbName: "test", docId });
    expect(rGetB.Ok().status).toBe("ok");
    expect((rGetB.Ok() as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ v: "b" }));
  });
});
