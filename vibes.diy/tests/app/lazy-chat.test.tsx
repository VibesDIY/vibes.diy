// Tests the REAL lazy-chat proxy (makeLazyChatApi) shipped by the provider:
// the proxy must not build the VibesDiyApi instance until a property is
// accessed, must build at most once, and must bind methods to the instance so
// `this`-reliant methods (VibesDiyApi uses this.currentConnection etc.) work.
// (#2265 Track B, Phase 5)
//
// The live "no ChatSessions socket on a non-chat page" count is verified at
// runtime in Phase 6; here we pin the construct-on-access + binding contract.

import { describe, it, expect, vi } from "vitest";
import { makeLazyChatApi } from "~/vibes.diy/app/lazy-chat-api.js";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

describe("makeLazyChatApi", () => {
  it("does not build the instance until a property is accessed", () => {
    const build = vi.fn(() => ({ openChat: vi.fn() }) as unknown as VibesDiyApiIface);
    const proxy = makeLazyChatApi(build);
    expect(build).not.toHaveBeenCalled(); // constructing the proxy opens nothing

    void (proxy as unknown as { openChat: () => void }).openChat();
    expect(build).toHaveBeenCalledOnce();
  });

  it("builds at most once and reuses the instance across accesses", () => {
    const api = { openChat: vi.fn(), getChatDetails: vi.fn() } as unknown as VibesDiyApiIface;
    const build = vi.fn(() => api);
    const proxy = makeLazyChatApi(build) as unknown as { openChat: () => void; getChatDetails: () => void };

    proxy.openChat();
    proxy.getChatDetails();
    proxy.openChat();
    expect(build).toHaveBeenCalledOnce();
  });

  it("binds methods to the instance so `this`-reliant methods keep their state", () => {
    // A `this`-reliant class like VibesDiyApi: regular methods, real fields, no
    // arrow binding. Without method binding the proxy would call setState with
    // `this` = proxy; since the proxy has no set trap, the write would land on
    // the empty proxy target and getState would read undefined from the instance.
    class StatefulApi {
      private value = 0;
      setValue(v: number): void {
        this.value = v;
      }
      getValue(): number {
        return this.value;
      }
    }
    const instance = new StatefulApi();
    const proxy = makeLazyChatApi(() => instance as unknown as VibesDiyApiIface) as unknown as StatefulApi;

    proxy.setValue(42);
    expect(proxy.getValue()).toBe(42); // fails if methods aren't bound to `instance`
    expect(instance.getValue()).toBe(42); // the write reached the real instance
  });

  it("returns non-function properties directly (no binding)", () => {
    const api = { ready: true, openChat: vi.fn() } as unknown as VibesDiyApiIface;
    const proxy = makeLazyChatApi(() => api) as unknown as { ready: boolean };
    expect(proxy.ready).toBe(true);
  });
});
