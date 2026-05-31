import { describe, it, expect, vi } from "vitest";
import { Result } from "@adviser/cement";
import type { VibesDiyApi } from "./index.js";
import { FireflyApiAdapter } from "./firefly-api-adapter.js";

function fakeVibesDiyApi(overrides: Partial<Record<string, unknown>> = {}): VibesDiyApi {
  return {
    ensureUserSettings: vi.fn(async () =>
      Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: "user-1",
        settings: [{ type: "defaultUserSlug", userSlug: "alice" }],
        updated: "now",
        created: "now",
      })
    ),
    onDocChanged: vi.fn(() => () => undefined),
    ...overrides,
  } as unknown as VibesDiyApi;
}

describe("FireflyApiAdapter", () => {
  it("exposes svc.vibeApp.appSlug from constructor", () => {
    const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
    expect(adapter.svc.vibeApp.appSlug).toBe("my-app");
  });

  it("resolves userHandle from ensureUserSettings.defaultUserSlug on first request", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app");
    const slug = await adapter.resolveUserHandle();
    expect(slug).toBe("alice");
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
    // Second call uses the cache
    await adapter.resolveUserHandle();
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
  });

  it("uses opts.userHandle override and skips ensureUserSettings", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app", { userHandle: "bob" });
    expect(await adapter.resolveUserHandle()).toBe("bob");
    expect(api.ensureUserSettings).not.toHaveBeenCalled();
  });

  it("throws when ensureUserSettings has no defaultUserSlug entry", async () => {
    const api = fakeVibesDiyApi({
      ensureUserSettings: vi.fn(async () =>
        Result.Ok({
          type: "vibes.diy.res-ensure-user-settings",
          userId: "user-1",
          settings: [],
          updated: "now",
          created: "now",
        })
      ),
    });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await expect(adapter.resolveUserHandle()).rejects.toThrow(/defaultUserSlug/);
  });

  it("putDoc translates positional call to request object with appSlug+userSlug+dbName", async () => {
    const putDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "doc-1" }));
    const api = fakeVibesDiyApi({ putDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const res = await adapter.putDoc({ text: "hello" }, "doc-1", "todos");
    expect(res.isOk()).toBe(true);
    expect(putDoc).toHaveBeenCalledWith({
      appSlug: "my-app",
      userSlug: "alice",
      dbName: "todos",
      doc: { text: "hello" },
      docId: "doc-1",
    });
  });

  it("putDoc defaults dbName to 'default' when omitted", async () => {
    const putDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "x" }));
    const api = fakeVibesDiyApi({ putDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.putDoc({ a: 1 });
    expect(putDoc).toHaveBeenCalledWith(expect.objectContaining({ dbName: "default" }));
  });

  it("getDoc routes through VibesDiyApi.getDoc", async () => {
    const getDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-get-doc", status: "ok", id: "doc-1", doc: { text: "hi" } }));
    const api = fakeVibesDiyApi({ getDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.getDoc("doc-1", "todos");
    expect(getDoc).toHaveBeenCalledWith({
      appSlug: "my-app",
      userSlug: "alice",
      dbName: "todos",
      docId: "doc-1",
    });
  });

  it("queryDocs routes through VibesDiyApi.queryDocs", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.queryDocs("todos");
    expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", userSlug: "alice", dbName: "todos" });
  });

  it("queryDocs passes filter hint to VibesDiyApi.queryDocs when provided", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const filter = { field: "status", key: "active" };
    await adapter.queryDocs("todos", filter);
    expect(queryDocs).toHaveBeenCalledWith({
      appSlug: "my-app",
      userSlug: "alice",
      dbName: "todos",
      filter,
    });
  });

  it("queryDocs omits filter key when filter is undefined", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.queryDocs("todos");
    expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", userSlug: "alice", dbName: "todos" });
  });

  it("deleteDoc routes through VibesDiyApi.deleteDoc", async () => {
    const deleteDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-delete-doc", status: "ok", id: "doc-1" }));
    const api = fakeVibesDiyApi({ deleteDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.deleteDoc("doc-1", "todos");
    expect(deleteDoc).toHaveBeenCalledWith({
      appSlug: "my-app",
      userSlug: "alice",
      dbName: "todos",
      docId: "doc-1",
    });
  });

  it("subscribeDocs routes through VibesDiyApi.subscribeDocs", async () => {
    const subscribeDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }));
    const api = fakeVibesDiyApi({ subscribeDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.subscribeDocs("todos");
    expect(subscribeDocs).toHaveBeenCalledWith({ appSlug: "my-app", userSlug: "alice", dbName: "todos" });
  });

  it("putAsset throws — file uploads not supported in v1", async () => {
    const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
    await expect(adapter.putAsset(new Blob(["x"]))).rejects.toThrow(/file uploads not supported/i);
  });

  it("multiple onMsg subscribers each receive events independently", () => {
    const onDocChanged = vi.fn(() => () => undefined);
    const api = fakeVibesDiyApi({ onDocChanged });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    adapter.onMsg((e) => seenA.push(e.data));
    adapter.onMsg((e) => seenB.push(e.data));
    expect(onDocChanged).toHaveBeenCalledTimes(2);
  });

  it("onMsg synthesizes evt-doc-changed events from VibesDiyApi.onDocChanged", () => {
    let captured: ((u: string, a: string, db: string, doc: string) => void) | undefined;
    const onDocChanged = vi.fn((fn: typeof captured) => {
      captured = fn;
      return () => undefined;
    });
    const api = fakeVibesDiyApi({ onDocChanged });
    const adapter = new FireflyApiAdapter(api, "my-app");

    const seen: unknown[] = [];
    adapter.onMsg((event) => seen.push(event.data));

    expect(captured).toBeDefined();
    captured?.("alice", "my-app", "todos", "doc-1");

    expect(seen).toEqual([
      {
        type: "vibes.diy.evt-doc-changed",
        ownerHandle: "alice",
        appSlug: "my-app",
        dbName: "todos",
        docId: "doc-1",
      },
    ]);
  });
});
