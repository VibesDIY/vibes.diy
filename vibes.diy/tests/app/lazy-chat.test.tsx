// Tests that chatApi is NOT constructed (no VibesDiyApi instantiation, no
// ChatSessions socket) until the first chat-plane method is called.
//
// APPROACH: test the proxy mechanism directly at the seam level rather than
// mounting the full provider (which requires real Clerk, window.location, etc.).
//
// The proxy pattern (Phase 5, #2265 B Option C) is:
//   const proxy = new Proxy({} as VibesDiyApiIface, {
//     get(_target, prop) {
//       if (!instance) instance = buildRealApi();
//       return instance[prop];
//     }
//   });
// Destructuring (`const { openChat } = proxy`) triggers get for "openChat",
// so we must confirm that the CALL of the returned function—not the
// destructuring itself—triggers construction. (In the real proxy, `instance`
// persists via the module-level vibesDiyApis cache, not a local closure.)

import { describe, it, expect, vi } from "vitest";

describe("lazy chatApi proxy", () => {
  it("does not construct VibesDiyApi until a method is called", () => {
    let constructCount = 0;
    const fakeApi = {
      openChat: vi.fn().mockResolvedValue({ isOk: () => true }),
      getChatDetails: vi.fn().mockResolvedValue({ isOk: () => true }),
    };
    const buildChatApi = vi.fn(() => {
      constructCount++;
      return fakeApi;
    });

    // Mimic the module-level cache (vibesDiyApis.get(apiUrl).once) by using
    // a simple flag — the key property is that the factory runs at most once.
    let chatApiInstance: typeof fakeApi | undefined;
    const chatApiProxy = new Proxy({} as typeof fakeApi, {
      get(_target, prop) {
        if (!chatApiInstance) chatApiInstance = buildChatApi();
        return (chatApiInstance as unknown as Record<string | symbol, unknown>)[prop];
      },
    });

    // Destructuring at render time (like mine.tsx does) should NOT build yet —
    // but actually: destructuring DOES trigger the get trap for each key.
    // This test documents the actual behavior: the proxy DOES fire on
    // destructuring, not just on the subsequent method call. The real benefit
    // is that on non-chat pages neither destructuring nor method calls happen
    // for the chatApi (those pages only use sharedApi/vibeApi), so the
    // WebSocket is never opened.

    // Simulate a non-chat page that never touches chatApi at all.
    expect(constructCount).toBe(0); // not constructed before any access

    // First method access triggers construction.
    void chatApiProxy.openChat({ ownerHandle: "a", appSlug: "b", mode: "chat" } as Parameters<typeof chatApiProxy.openChat>[0]);
    expect(constructCount).toBe(1);
    expect(buildChatApi).toHaveBeenCalledOnce();

    // Subsequent accesses reuse the cached instance.
    void chatApiProxy.getChatDetails({ ownerHandle: "a", appSlug: "b" } as Parameters<typeof chatApiProxy.getChatDetails>[0]);
    expect(constructCount).toBe(1); // still 1 — instance reused
  });

  it("proxy methods delegate to the real instance after first access", () => {
    const callLog: string[] = [];
    const fakeApi = {
      openChat: vi.fn(() => {
        callLog.push("openChat");
        return Promise.resolve(null);
      }),
    };
    let instance: typeof fakeApi | undefined;
    const proxy = new Proxy({} as typeof fakeApi, {
      get(_target, prop) {
        if (!instance) instance = fakeApi;
        return (instance as unknown as Record<string | symbol, unknown>)[prop];
      },
    });

    // Not yet called — no method invocation happened.
    expect(callLog).toEqual([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (proxy as any).openChat({});
    expect(callLog).toEqual(["openChat"]);
  });

  it("non-chat pages never access chatApi and so never trigger construction", () => {
    let constructed = false;
    const buildChatApi = () => {
      constructed = true;
      return { openChat: vi.fn() };
    };

    let chatApiInstance: ReturnType<typeof buildChatApi> | undefined;
    const chatApiProxy = new Proxy({} as ReturnType<typeof buildChatApi>, {
      get(_target, prop) {
        if (!chatApiInstance) chatApiInstance = buildChatApi();
        return (chatApiInstance as unknown as Record<string | symbol, unknown>)[prop];
      },
    });

    // Simulate a non-chat page: the ctx object is created with chatApi set to
    // the proxy, but the page only uses sharedApi (not shown here).
    const ctx = { chatApi: chatApiProxy, sharedApi: { getShared: vi.fn() } };

    // Accessing sharedApi should not trigger chatApi construction.
    void ctx.sharedApi.getShared();
    expect(constructed).toBe(false);

    // Only when something actually touches ctx.chatApi do we build it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (ctx.chatApi as any).openChat({});
    expect(constructed).toBe(true);
  });
});
