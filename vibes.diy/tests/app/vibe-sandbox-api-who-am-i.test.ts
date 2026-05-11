import { describe, it, expect, afterEach } from "vitest";
import { VibeSandboxApi, bootstrapViewer } from "@vibes.diy/vibe-runtime";

describe("bootstrapViewer", () => {
  let capturedEvents: MessageEvent[] = [];
  let originalDispatch: typeof window.dispatchEvent;

  afterEach(() => {
    if (originalDispatch) {
      window.dispatchEvent = originalDispatch;
    }
    capturedEvents = [];
  });

  it("dispatches vibe.evt.viewerChanged with viewer data on success", async () => {
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    // Ack the host so whoAmI can proceed.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const bootstrapPromise = bootstrapViewer(api);

    // Yield so whoAmI posts its request.
    await Promise.resolve();
    await Promise.resolve();

    const sentTid = (posts[0] as { tid: string }).tid;
    expect((posts[0] as { type: string }).type).toBe("vibe.req.whoAmI");

    // Reply with a real viewer.
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.whoAmI",
          tid: sentTid,
          viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
          access: "owner",
          dbAcls: { comments: { write: ["members"], delete: ["members"] } },
        },
      } as MessageEvent)
    );

    await bootstrapPromise;

    expect(capturedEvents).toHaveLength(1);
    const evt = capturedEvents[0];
    expect(evt.data.type).toBe("vibe.evt.viewerChanged");
    expect(evt.data.viewer).toEqual({ userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" });
    expect(evt.data.access).toBe("owner");
    expect(evt.data.dbAcls).toEqual({ comments: { write: ["members"], delete: ["members"] } });
  });

  it("dispatches viewerChanged with viewer: null when the host reports an anonymous session", async () => {
    // viewer: null is a valid whoAmI success (signed-out user). bootstrapViewer
    // should still dispatch vibe.evt.viewerChanged so VibeContext updates its state
    // (e.g. clears a previously cached identity on sign-out).
    capturedEvents = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = (event: Event) => {
      if (event instanceof MessageEvent) capturedEvents.push(event);
      return true;
    };

    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const bootstrapPromise = bootstrapViewer(api);
    await Promise.resolve();
    await Promise.resolve();

    const sentTid = (posts[0] as { tid: string }).tid;
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.whoAmI",
          tid: sentTid,
          viewer: null,
          access: "none",
        },
      } as MessageEvent)
    );
    await bootstrapPromise;

    expect(capturedEvents).toHaveLength(1);
    expect(capturedEvents[0].data.type).toBe("vibe.evt.viewerChanged");
    expect(capturedEvents[0].data.viewer).toBeNull();
    expect(capturedEvents[0].data.access).toBe("none");
  });
});

describe("VibeSandboxApi.whoAmI", () => {
  it("posts vibe.req.whoAmI with appSlug+userSlug and resolves on a matching response", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });
    // Pretend the host has acked.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));
    const pending = api.whoAmI();
    // Yield so the request has a chance to postMessage.
    await Promise.resolve();
    const sentTid = (posts[0] as { tid: string }).tid;
    expect((posts[0] as { type: string }).type).toBe("vibe.req.whoAmI");
    expect((posts[0] as { appSlug: string }).appSlug).toBe("myapp");
    expect((posts[0] as { userSlug: string }).userSlug).toBe("alice");
    listeners.forEach((h) =>
      h({
        data: {
          type: "vibe.res.whoAmI",
          tid: sentTid,
          viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
          access: "owner",
        },
      } as MessageEvent)
    );
    const res = await pending;
    expect(res.isOk()).toBe(true);
    expect(res.Ok().viewer?.userSlug).toBe("alice");
  });
});
