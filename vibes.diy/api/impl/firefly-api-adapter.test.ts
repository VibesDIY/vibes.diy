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
        settings: [{ type: "defaultHandle", ownerHandle: "alice" }],
        updated: "now",
        created: "now",
      })
    ),
    onDocChanged: vi.fn(() => () => undefined),
    onDocEphemeral: vi.fn(() => () => undefined),
    onDocEphemeralDrop: vi.fn(() => () => undefined),
    broadcastEphemeral: vi.fn(() => undefined),
    onReconnect: vi.fn(() => () => undefined),
    subscribeViewerGrants: vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" })),
    onViewerGrantsChanged: vi.fn(() => () => undefined),
    ...overrides,
  } as unknown as VibesDiyApi;
}

describe("FireflyApiAdapter", () => {
  it("exposes svc.vibeApp.appSlug from constructor", () => {
    const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
    expect(adapter.svc.vibeApp.appSlug).toBe("my-app");
  });

  it("resolves userHandle from ensureUserSettings.defaultHandle on first request", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app");
    const slug = await adapter.resolveOwnerHandle();
    expect(slug).toBe("alice");
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
    // Second call uses the cache
    await adapter.resolveOwnerHandle();
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
  });

  it("uses opts.ownerHandle override and skips ensureUserSettings", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "bob" });
    expect(await adapter.resolveOwnerHandle()).toBe("bob");
    expect(api.ensureUserSettings).not.toHaveBeenCalled();
  });

  it("throws when ensureUserSettings has no defaultHandle entry", async () => {
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
    await expect(adapter.resolveOwnerHandle()).rejects.toThrow(/defaultHandle/);
  });

  it("putDoc translates positional call to request object with appSlug+ownerHandle+dbName", async () => {
    const putDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "doc-1" }));
    const api = fakeVibesDiyApi({ putDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const res = await adapter.putDoc({ text: "hello" }, "doc-1", "todos");
    expect(res.isOk()).toBe(true);
    expect(putDoc).toHaveBeenCalledWith({
      appSlug: "my-app",
      ownerHandle: "alice",
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
      ownerHandle: "alice",
      dbName: "todos",
      docId: "doc-1",
    });
  });

  it("queryDocs routes through VibesDiyApi.queryDocs", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.queryDocs("todos");
    expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", ownerHandle: "alice", dbName: "todos" });
  });

  it("queryDocs passes filter hint to VibesDiyApi.queryDocs when provided", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const filter = { field: "status", key: "active" };
    await adapter.queryDocs("todos", filter);
    expect(queryDocs).toHaveBeenCalledWith({
      appSlug: "my-app",
      ownerHandle: "alice",
      dbName: "todos",
      filter,
    });
  });

  it("queryDocs omits filter key when filter is undefined", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.queryDocs("todos");
    expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", ownerHandle: "alice", dbName: "todos" });
  });

  it("deleteDoc routes through VibesDiyApi.deleteDoc", async () => {
    const deleteDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-delete-doc", status: "ok", id: "doc-1" }));
    const api = fakeVibesDiyApi({ deleteDoc });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.deleteDoc("doc-1", "todos");
    expect(deleteDoc).toHaveBeenCalledWith({
      appSlug: "my-app",
      ownerHandle: "alice",
      dbName: "todos",
      docId: "doc-1",
    });
  });

  it("subscribeDocs routes through VibesDiyApi.subscribeDocs", async () => {
    const subscribeDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }));
    const api = fakeVibesDiyApi({ subscribeDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.subscribeDocs("todos");
    expect(subscribeDocs).toHaveBeenCalledWith({ appSlug: "my-app", ownerHandle: "alice", dbName: "todos" });
  });

  it("broadcastEphemeral (#1756) forwards docId+doc+dbName with baked-in appSlug/ownerHandle", () => {
    const broadcastEphemeral = vi.fn(() => undefined);
    const api = fakeVibesDiyApi({ broadcastEphemeral });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });
    adapter.broadcastEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 5 }, "todos");
    expect(broadcastEphemeral).toHaveBeenCalledWith({
      appSlug: "my-app",
      ownerHandle: "alice",
      dbName: "todos",
      docId: "cursor-a",
      doc: { _id: "cursor-a", type: "cursor", curX: 5 },
    });
  });

  it("broadcastEphemeral defaults dbName to 'default' when omitted", () => {
    const broadcastEphemeral = vi.fn(() => undefined);
    const api = fakeVibesDiyApi({ broadcastEphemeral });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });
    adapter.broadcastEphemeral("cursor-a", { curX: 1 });
    expect(broadcastEphemeral).toHaveBeenCalledWith(expect.objectContaining({ dbName: "default" }));
  });

  it("broadcastEphemeral drops the frame when ownerHandle not yet resolved", () => {
    const broadcastEphemeral = vi.fn(() => undefined);
    const api = fakeVibesDiyApi({ broadcastEphemeral });
    // No ownerHandle override → svc.vibeApp.ownerHandle starts empty until resolved.
    const adapter = new FireflyApiAdapter(api, "my-app");
    adapter.broadcastEphemeral("cursor-a", { curX: 1 });
    expect(broadcastEphemeral).not.toHaveBeenCalled();
  });

  it("onMsg bridges evt-doc-ephemeral from VibesDiyApi.onDocEphemeral (full evt)", () => {
    let captured: ((evt: unknown) => void) | undefined;
    const onDocEphemeral = vi.fn((fn: typeof captured) => {
      captured = fn;
      return () => undefined;
    });
    const api = fakeVibesDiyApi({ onDocEphemeral });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const seen: unknown[] = [];
    adapter.onMsg((event) => seen.push(event.data));
    const evt = {
      type: "vibes.diy.evt-doc-ephemeral",
      ownerHandle: "alice",
      appSlug: "my-app",
      dbName: "todos",
      docId: "cursor-a",
      originPeer: "conn-1",
      doc: { _id: "cursor-a", curX: 9 },
      channel: "notes",
    };
    captured?.(evt);
    expect(seen).toContainEqual(evt);
  });

  it("onMsg bridges evt-doc-ephemeral-drop from VibesDiyApi.onDocEphemeralDrop", () => {
    let captured: ((originPeer: string) => void) | undefined;
    const onDocEphemeralDrop = vi.fn((fn: typeof captured) => {
      captured = fn;
      return () => undefined;
    });
    const api = fakeVibesDiyApi({ onDocEphemeralDrop });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const seen: unknown[] = [];
    adapter.onMsg((event) => seen.push(event.data));
    captured?.("gone-conn");
    expect(seen).toContainEqual({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "gone-conn" });
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

  it("on viewer-grants-changed, resubscribes every open db and emits onGrantsChanged", async () => {
    let grantsListener: ((evt: { ownerHandle: string; appSlug: string }) => void) | undefined;
    const subscribeDocs = vi.fn(async (_req: { appSlug: string; ownerHandle: string; dbName: string }) =>
      Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" })
    );
    const api = fakeVibesDiyApi({
      subscribeDocs,
      subscribeViewerGrants: vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" })),
      onViewerGrantsChanged: vi.fn((fn: (evt: { ownerHandle: string; appSlug: string }) => void) => {
        grantsListener = fn;
        return () => undefined;
      }),
    });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });
    await adapter.subscribeDocs("type-a");
    await adapter.subscribeDocs("type-b");
    await adapter.enableGrantReactivity();
    const seen: { ownerHandle: string; appSlug: string }[] = [];
    adapter.onGrantsChanged((evt) => seen.push(evt));
    subscribeDocs.mockClear();
    grantsListener?.({ ownerHandle: "alice", appSlug: "my-app" });
    await new Promise((r) => setTimeout(r, 0));
    const resubscribed = subscribeDocs.mock.calls.map((c) => c[0].dbName).sort();
    expect(resubscribed).toEqual(["type-a", "type-b"]);
    expect(seen).toEqual([{ ownerHandle: "alice", appSlug: "my-app" }]);
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

describe("FireflyApiAdapter — transient startup failure recovery (#2448)", () => {
  it("re-installs grant reactivity on reconnect after a failed first attempt", async () => {
    let reconnect: (() => void) | undefined;
    let grantsListener: ((evt: { ownerHandle: string; appSlug: string }) => void) | undefined;
    let attempt = 0;
    const subscribeViewerGrants = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error("API briefly unavailable");
      return Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" });
    });
    const onViewerGrantsChanged = vi.fn((fn: (evt: { ownerHandle: string; appSlug: string }) => void) => {
      grantsListener = fn;
      return () => undefined;
    });
    const api = fakeVibesDiyApi({
      subscribeViewerGrants,
      onViewerGrantsChanged,
      onReconnect: vi.fn((fn: () => void) => {
        reconnect = fn;
        return () => undefined;
      }),
    });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });

    // First install fails transiently — swallowed, mirroring the headless caller.
    await adapter.enableGrantReactivity().catch(() => undefined);
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(1);
    // Listener was never attached because the subscribe rejected before it.
    expect(onViewerGrantsChanged).not.toHaveBeenCalled();

    // Connection recovers — the lifecycle callback retries the install.
    reconnect?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(2);
    expect(onViewerGrantsChanged).toHaveBeenCalledTimes(1);
    expect(grantsListener).toBeDefined();
  });

  it("does not re-install grant reactivity once it has succeeded", async () => {
    let reconnect: (() => void) | undefined;
    const subscribeViewerGrants = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" }));
    const onViewerGrantsChanged = vi.fn(() => () => undefined);
    const api = fakeVibesDiyApi({
      subscribeViewerGrants,
      onViewerGrantsChanged,
      onReconnect: vi.fn((fn: () => void) => {
        reconnect = fn;
        return () => undefined;
      }),
    });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });
    await adapter.enableGrantReactivity();
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(1);
    expect(onViewerGrantsChanged).toHaveBeenCalledTimes(1);

    // A later reconnect must not re-subscribe or stack a duplicate listener —
    // replayConnectionState handles already-recorded subscriptions.
    reconnect?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(1);
    expect(onViewerGrantsChanged).toHaveBeenCalledTimes(1);
  });

  it("re-issues a per-db subscription on reconnect after a failed first attempt", async () => {
    let reconnect: (() => void) | undefined;
    let attempt = 0;
    const subscribeDocs = vi.fn(async (_req: { appSlug: string; ownerHandle: string; dbName: string }) => {
      attempt++;
      if (attempt === 1) throw new Error("API briefly unavailable");
      return Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" });
    });
    const api = fakeVibesDiyApi({
      subscribeDocs,
      onReconnect: vi.fn((fn: () => void) => {
        reconnect = fn;
        return () => undefined;
      }),
    });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });

    // First subscribe fails transiently — caller swallows (FireflyDatabase.resubscribe).
    await adapter.subscribeDocs("todos").catch(() => undefined);
    expect(subscribeDocs).toHaveBeenCalledTimes(1);

    // Reconnect re-issues the subscription for the db that was opened.
    reconnect?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeDocs).toHaveBeenCalledTimes(2);
    expect(subscribeDocs.mock.calls[1][0].dbName).toBe("todos");
  });

  it("arms the reconnect retry only once across many subscribeDocs calls", async () => {
    const onReconnect = vi.fn(() => () => undefined);
    const subscribeDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }));
    const api = fakeVibesDiyApi({ subscribeDocs, onReconnect });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });
    await adapter.subscribeDocs("a");
    await adapter.subscribeDocs("b");
    await adapter.enableGrantReactivity();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("retries owner-handle resolution after a transient failure (no override)", async () => {
    let attempt = 0;
    const ensureUserSettings = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error("WS unavailable");
      return Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: "user-1",
        settings: [{ type: "defaultHandle", ownerHandle: "alice" }],
        updated: "now",
        created: "now",
      });
    });
    const api = fakeVibesDiyApi({ ensureUserSettings });
    const adapter = new FireflyApiAdapter(api, "my-app"); // no ownerHandle override

    // First lookup fails transiently and must NOT be cached as a permanent rejection.
    await expect(adapter.resolveOwnerHandle()).rejects.toThrow(/WS unavailable/);
    // A retry re-runs the lookup and resolves.
    expect(await adapter.resolveOwnerHandle()).toBe("alice");
    expect(ensureUserSettings).toHaveBeenCalledTimes(2);
  });

  it("retries grant reactivity when subscribeViewerGrants returns Result.Err (not just throws)", async () => {
    let reconnect: (() => void) | undefined;
    let attempt = 0;
    const subscribeViewerGrants = vi.fn(async () => {
      attempt++;
      if (attempt === 1) return Result.Err("request timeout");
      return Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" });
    });
    const onViewerGrantsChanged = vi.fn(() => () => undefined);
    const api = fakeVibesDiyApi({
      subscribeViewerGrants,
      onViewerGrantsChanged,
      onReconnect: vi.fn((fn: () => void) => {
        reconnect = fn;
        return () => undefined;
      }),
    });
    const adapter = new FireflyApiAdapter(api, "my-app", { ownerHandle: "alice" });

    // An Err result (timeout / WS close before response) must not mark installed
    // or attach the listener — the sub was never recorded for replay.
    await adapter.enableGrantReactivity().catch(() => undefined);
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(1);
    expect(onViewerGrantsChanged).not.toHaveBeenCalled();

    // Reconnect retries and this time the subscribe succeeds.
    reconnect?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(subscribeViewerGrants).toHaveBeenCalledTimes(2);
    expect(onViewerGrantsChanged).toHaveBeenCalledTimes(1);
  });
});

describe("FireflyApiAdapter — async factory", () => {
  it("accepts an async api factory and resolves it once", async () => {
    const api = fakeVibesDiyApi({
      putDoc: vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "x" })),
    });
    let built = 0;
    const adapter = new FireflyApiAdapter(
      async () => {
        built++;
        return api as unknown as VibesDiyApi;
      },
      "my-app",
      { ownerHandle: "alice" }
    );
    await adapter.putDoc({ hello: "world" });
    await adapter.putDoc({ hello: "again" });
    expect(built).toBe(1); // factory resolved exactly once
  });
});

describe("FireflyApiAdapter — adminMode", () => {
  it("queryDocs with adminMode:true includes adminMode:true in the request", async () => {
    const capturedReqs: unknown[] = [];
    const fakeApi = {
      queryDocs: vi.fn(async (req: unknown) => {
        capturedReqs.push(req);
        return Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] });
      }),
    } as unknown as import("./index.js").VibesDiyApi;

    const adapter = new FireflyApiAdapter(fakeApi, "app1", { ownerHandle: "alice", adminMode: true });
    await adapter.queryDocs("db1");
    expect(capturedReqs).toHaveLength(1);
    expect((capturedReqs[0] as Record<string, unknown>).adminMode).toBe(true);
  });

  it("queryDocs with adminMode:true passes adminMode:true on every call (no memoization needed)", async () => {
    const capturedReqs: unknown[] = [];
    const fakeApi = {
      queryDocs: vi.fn(async (req: unknown) => {
        capturedReqs.push(req);
        return Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] });
      }),
    } as unknown as import("./index.js").VibesDiyApi;

    const adapter = new FireflyApiAdapter(fakeApi, "app1", { ownerHandle: "alice", adminMode: true });
    await adapter.queryDocs("db1");
    await adapter.queryDocs("db1");
    expect(capturedReqs).toHaveLength(2);
    for (const req of capturedReqs) {
      expect((req as Record<string, unknown>).adminMode).toBe(true);
    }
  });

  it("queryDocs without adminMode does NOT include adminMode field in the request", async () => {
    const capturedReqs: unknown[] = [];
    const fakeApi = {
      queryDocs: vi.fn(async (req: unknown) => {
        capturedReqs.push(req);
        return Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] });
      }),
    } as unknown as import("./index.js").VibesDiyApi;

    const adapter = new FireflyApiAdapter(fakeApi, "app1", { ownerHandle: "alice" });
    await adapter.queryDocs("db1");
    expect(capturedReqs).toHaveLength(1);
    expect((capturedReqs[0] as Record<string, unknown>).adminMode).toBeUndefined();
  });

  it("getDoc with adminMode:true includes adminMode:true in the request", async () => {
    const capturedReqs: unknown[] = [];
    const fakeApi = {
      getDoc: vi.fn(async (req: unknown) => {
        capturedReqs.push(req);
        return Result.Ok({ type: "vibes.diy.res-get-doc", status: "not-found", id: "x" });
      }),
    } as unknown as import("./index.js").VibesDiyApi;

    const adapter = new FireflyApiAdapter(fakeApi, "app1", { ownerHandle: "alice", adminMode: true });
    await adapter.getDoc("x", "db1");
    expect(capturedReqs).toHaveLength(1);
    expect((capturedReqs[0] as Record<string, unknown>).adminMode).toBe(true);
  });

  it("getDoc without adminMode does NOT include adminMode field in the request", async () => {
    const capturedReqs: unknown[] = [];
    const fakeApi = {
      getDoc: vi.fn(async (req: unknown) => {
        capturedReqs.push(req);
        return Result.Ok({ type: "vibes.diy.res-get-doc", status: "not-found", id: "x" });
      }),
    } as unknown as import("./index.js").VibesDiyApi;

    const adapter = new FireflyApiAdapter(fakeApi, "app1", { ownerHandle: "alice" });
    await adapter.getDoc("x", "db1");
    expect(capturedReqs).toHaveLength(1);
    expect((capturedReqs[0] as Record<string, unknown>).adminMode).toBeUndefined();
  });
});
