import { describe, it, expect } from "vitest";
import { VibeSandboxApi } from "@vibes.diy/vibe-runtime";

describe("VibeSandboxApi.updateAvatarCid", () => {
  it("sends vibe.req.updateAvatarCid and resolves on ok response", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    // Ack the host so requests can flow.
    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const promise = api.updateAvatarCid("bafycid123");

    await Promise.resolve();
    await Promise.resolve();

    const req = posts.find((p) => (p as { type: string }).type === "vibe.req.updateAvatarCid") as {
      type: string;
      tid: string;
      userSlug: string;
      appSlug: string;
      cid: string;
    };
    expect(req).toBeDefined();
    expect(req.userSlug).toBe("alice");
    expect(req.appSlug).toBe("myapp");
    expect(req.cid).toBe("bafycid123");

    // Reply ok.
    listeners.forEach((h) => h({ data: { type: "vibe.res.updateAvatarCid", tid: req.tid, status: "ok" } } as MessageEvent));

    const r = await promise;
    expect(r.isOk()).toBe(true);
    expect(r.Ok().status).toBe("ok");
  });

  it("resolves with error status when the host rejects", async () => {
    const posts: unknown[] = [];
    const listeners: ((e: MessageEvent) => void)[] = [];
    const api = new VibeSandboxApi({
      vibeApp: { appSlug: "myapp", userSlug: "alice", fsId: "fs1" },
      addEventListener: ((_t: string, h: (e: MessageEvent) => void) => listeners.push(h)) as typeof window.addEventListener,
      postMessage: ((msg: unknown) => posts.push(msg)) as typeof window.postMessage,
    });

    listeners.forEach((h) => h({ data: { type: "vibe.evt.runtime.ack" } } as MessageEvent));

    const promise = api.updateAvatarCid("bafycid456");
    await Promise.resolve();
    await Promise.resolve();

    const req = posts.find((p) => (p as { type: string }).type === "vibe.req.updateAvatarCid") as { tid: string };
    listeners.forEach((h) =>
      h({ data: { type: "vibe.res.updateAvatarCid", tid: req.tid, status: "error", message: "unauthorized" } } as MessageEvent)
    );

    const r = await promise;
    expect(r.isOk()).toBe(true);
    expect(r.Ok().status).toBe("error");
    expect(r.Ok().message).toBe("unauthorized");
  });
});
