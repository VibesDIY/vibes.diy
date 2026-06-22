import { describe, it, expect, afterEach } from "vitest";
import { VibeSandboxApi, bootstrapAccessFnSources, getRegisteredAccessFnSources } from "@vibes.diy/vibe-runtime";

describe("bootstrapAccessFnSources", () => {
  let capturedEvents: MessageEvent[] = [];
  let originalDispatch: typeof window.dispatchEvent;

  afterEach(() => {
    if (originalDispatch) {
      window.dispatchEvent = originalDispatch;
    }
    capturedEvents = [];
  });

  it("fetches and dispatches vibe.evt.accessFnSource for a single binding", async () => {
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    // Ack the host so the bridge is live.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const bootstrapPromise = bootstrapAccessFnSources(api, [{ dbName: "mydb", accessFnCid: "bafy1" }]);

    // Yield so the RPC has a chance to postMessage.
    await Promise.resolve();
    await Promise.resolve();

    expect((posts[0] as { type: string }).type).toBe("vibe.req.accessFnSource");
    expect((posts[0] as { cid: string }).cid).toBe("bafy1");
    const sentTid = (posts[0] as { tid: string }).tid;

    // Reply with source.
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.accessFnSource",
          tid: sentTid,
          cid: "bafy1",
          source: "export function mydb(){}",
        },
      } as MessageEvent)
    );

    await bootstrapPromise;

    expect(capturedEvents).toHaveLength(1);
    const evt = capturedEvents[0];
    expect(evt.data.type).toBe("vibe.evt.accessFnSource");
    expect(evt.data.cid).toBe("bafy1");
    expect(evt.data.source).toBe("export function mydb(){}");

    // Also recorded in the module baseline so a late-mounting VibeContext that
    // missed the event still seeds this source (the dispatch-before-listener guard).
    expect(getRegisteredAccessFnSources().get("bafy1")).toBe("export function mydb(){}");
  });

  it("dispatches vibe.evt.accessFnSource with source: null when the host has no source", async () => {
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const bootstrapPromise = bootstrapAccessFnSources(api, [{ dbName: "mydb", accessFnCid: "bafy2" }]);

    await Promise.resolve();
    await Promise.resolve();

    const sentTid = (posts[0] as { tid: string }).tid;

    // Reply with source: null (resolved-unknown — no binding/asset found).
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.accessFnSource",
          tid: sentTid,
          cid: "bafy2",
          source: null,
        },
      } as MessageEvent)
    );

    await bootstrapPromise;

    expect(capturedEvents).toHaveLength(1);
    const evt = capturedEvents[0];
    expect(evt.data.type).toBe("vibe.evt.accessFnSource");
    expect(evt.data.cid).toBe("bafy2");
    expect(evt.data.source).toBeNull();
  });

  it("deduplicates CIDs — two bindings sharing one accessFnCid cause exactly one RPC", async () => {
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    // Two bindings share the same accessFnCid — only one RPC should be sent.
    const bootstrapPromise = bootstrapAccessFnSources(api, [
      { dbName: "db1", accessFnCid: "sharedCid" },
      { dbName: "db2", accessFnCid: "sharedCid" },
    ]);

    await Promise.resolve();
    await Promise.resolve();

    // Only one RPC should have been posted.
    const accessFnPosts = (posts as { type: string }[]).filter((p) => p.type === "vibe.req.accessFnSource");
    expect(accessFnPosts).toHaveLength(1);
    expect((accessFnPosts[0] as { cid: string }).cid).toBe("sharedCid");

    const sentTid = (accessFnPosts[0] as { tid: string }).tid;
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.accessFnSource",
          tid: sentTid,
          cid: "sharedCid",
          source: "export function shared(){}",
        },
      } as MessageEvent)
    );

    await bootstrapPromise;

    // Only one event dispatched (for the single deduplicated CID).
    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].data.cid).toBe("sharedCid");
  });

  it("returns early when bindings is undefined", async () => {
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    await bootstrapAccessFnSources(api, undefined);

    expect(posts).toHaveLength(0);
    expect(capturedEvents).toHaveLength(0);
  });
});
