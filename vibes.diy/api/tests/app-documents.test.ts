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

    // Create an app to get a valid appSlug
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
  });

  it("putDoc creates a document and returns id", async () => {
    const rRes = await api.putDoc({ appSlug, dbName: "test", doc: { title: "hello" } });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect(res.status).toBe("ok");
    expect(res.id).toBeDefined();
  });

  it("putDoc with explicit docId uses that id", async () => {
    const rRes = await api.putDoc({ appSlug, dbName: "test", doc: { title: "explicit" }, docId: "my-doc-id" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().id).toBe("my-doc-id");
  });

  it("getDoc retrieves latest revision", async () => {
    const putRes = await api.putDoc({ appSlug, dbName: "test", doc: { title: "getme" }, docId: "get-test" });
    expect(putRes.isOk()).toBe(true);

    const rRes = await api.getDoc({ appSlug, dbName: "test", docId: "get-test" });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect(res.status).toBe("ok");
    expect(res.id).toBe("get-test");
    expect((res as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ title: "getme" }));
  });

  it("putDoc same docId increments seq, latest wins", async () => {
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "v1" }, docId: "seq-test" });
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "v2" }, docId: "seq-test" });

    const rRes = await api.getDoc({ appSlug, dbName: "test", docId: "seq-test" });
    expect(rRes.isOk()).toBe(true);
    const res = rRes.Ok();
    expect((res as { doc: Record<string, unknown> }).doc).toEqual(expect.objectContaining({ title: "v2" }));
  });

  it("getDoc returns not-found for missing doc", async () => {
    const rRes = await api.getDoc({ appSlug, dbName: "test", docId: "nonexistent" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("not-found");
  });

  it("deleteDoc inserts tombstone", async () => {
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "delete-me" }, docId: "del-test" });
    const rRes = await api.deleteDoc({ appSlug, dbName: "test", docId: "del-test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });

  it("getDoc returns not-found for deleted doc", async () => {
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "soon-gone" }, docId: "del-get-test" });
    await api.deleteDoc({ appSlug, dbName: "test", docId: "del-get-test" });

    const rRes = await api.getDoc({ appSlug, dbName: "test", docId: "del-get-test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("not-found");
  });

  it("queryDocs returns all non-deleted docs", async () => {
    // Create fresh docs with unique IDs
    const prefix = sthis.nextId(4).str;
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "one" }, docId: `${prefix}-1` });
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "two" }, docId: `${prefix}-2` });
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "three" }, docId: `${prefix}-3` });

    const rRes = await api.queryDocs({ appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    const prefixDocs = docs.filter((d) => d._id.startsWith(prefix));
    expect(prefixDocs).toHaveLength(3);
  });

  it("queryDocs deduplicates by latest seq", async () => {
    const docId = `dedup-${sthis.nextId(4).str}`;
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "v1" }, docId });
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "v2" }, docId });

    const rRes = await api.queryDocs({ appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    const matching = docs.filter((d) => d._id === docId);
    expect(matching).toHaveLength(1);
    expect(matching[0].title).toBe("v2");
  });

  it("queryDocs excludes deleted docs", async () => {
    const docId = `excl-${sthis.nextId(4).str}`;
    await api.putDoc({ appSlug, dbName: "test", doc: { title: "gone" }, docId });
    await api.deleteDoc({ appSlug, dbName: "test", docId });

    const rRes = await api.queryDocs({ appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    const docs = rRes.Ok().docs;
    expect(docs.find((d) => d._id === docId)).toBeUndefined();
  });

  it("subscribeDocs returns ok", async () => {
    const rRes = await api.subscribeDocs({ appSlug, dbName: "test" });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
  });
});
