import { describe, it, expect } from "vitest";
import { VibeSandboxApi } from "@vibes.diy/vibe-runtime";

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
          viewer: { userSlug: "alice", displayName: "Alice" },
          access: "owner",
        },
      } as MessageEvent)
    );
    const res = await pending;
    expect(res.isOk()).toBe(true);
    expect(res.Ok().viewer?.userSlug).toBe("alice");
  });
});
