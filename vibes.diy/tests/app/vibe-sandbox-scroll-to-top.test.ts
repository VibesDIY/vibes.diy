import { describe, it, expect } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

// pushScrollToTop is the host side of the iOS status-bar-tap relay: the
// parent detects the native gesture (main-frame only) and forwards it to the
// cross-origin vibe iframe as vibe.evt.scroll-to-top.
describe("vibesDiySrvSandbox.pushScrollToTop", () => {
  function makeSandbox() {
    const listeners: ((e: MessageEvent) => void | Promise<void>)[] = [];
    const sandbox = new vibesDiySrvSandbox({
      chatApi: {} as VibesDiyApiIface,
      errorLogger: () => undefined,
      eventListeners: {
        addEventListener: ((_t: string, h: (e: MessageEvent) => void) => {
          listeners.push(h);
        }) as typeof window.addEventListener,
        removeEventListener: (() => undefined) as typeof window.removeEventListener,
      },
    });
    return { sandbox, listeners };
  }

  it("is a silent no-op before the iframe's runtime.ready captured a target", () => {
    const { sandbox } = makeSandbox();
    expect(() => sandbox.pushScrollToTop()).not.toThrow();
  });

  it("posts vibe.evt.scroll-to-top to the captured iframe window", async () => {
    const { sandbox, listeners } = makeSandbox();
    const posts: unknown[] = [];
    const fakeSource = { postMessage: (msg: unknown) => posts.push(msg) } as unknown as Window;

    // Simulate the iframe's boot handshake so the sandbox captures its target.
    await Promise.all(
      listeners.map((h) =>
        h({
          data: { type: "vibe.evt.runtime.ready" },
          source: fakeSource,
          origin: "https://myapp--alice.example.test",
        } as unknown as MessageEvent)
      )
    );
    expect(posts).toContainEqual({ type: "vibe.evt.runtime.ack" });

    sandbox.pushScrollToTop();
    expect(posts).toContainEqual({ type: "vibe.evt.scroll-to-top" });
  });
});
