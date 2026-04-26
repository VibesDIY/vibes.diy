import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface } from "@vibes.diy/api-types";

// PostMsgSendProvider references `window` — provide a minimal global
beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = globalThis;
  }
});

// Minimal mock — we only need handleMessage, not the full API
function createSandbox() {
  const listeners: ((event: MessageEvent) => void)[] = [];
  const sandbox = new vibesDiySrvSandbox({
    vibeDiyApi: {
      onDocChanged: () => {
        /* noop for test */
      },
    } as unknown as VibesDiyApiIface,
    errorLogger: () => {
      /* noop for test */
    },
    eventListeners: {
      addEventListener: (_type: string, fn: EventListenerOrEventListenerObject) => {
        listeners.push(fn as (event: MessageEvent) => void);
      },
      removeEventListener: () => {
        /* noop for test */
      },
    },
  });
  return { sandbox, listeners };
}

function fakeMessageEvent(data: unknown, origin: string, source: Window | null = {} as Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

describe("iframeSource capture filtering", () => {
  it("captures iframeSource from vibe.* messages", () => {
    const { sandbox } = createSandbox();
    const fakeWindow = {} as Window;

    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.runtime.ready" }, "https://app--user.example.com", fakeWindow));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBe(fakeWindow);
    expect(internal.iframeOrigin).toBe("https://app--user.example.com");
  });

  it("ignores non-vibe messages (e.g. Clerk auth)", () => {
    const { sandbox } = createSandbox();

    sandbox.handleMessage(fakeMessageEvent({ type: "__clerk_handshake", payload: {} }, "https://vibes.diy", {} as Window));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBeUndefined();
    expect(internal.iframeOrigin).toBeUndefined();
  });

  it("ignores messages with no type field", () => {
    const { sandbox } = createSandbox();

    sandbox.handleMessage(fakeMessageEvent({ foo: "bar" }, "https://analytics.example.com", {} as Window));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBeUndefined();
  });

  it("ignores messages with null source", () => {
    const { sandbox } = createSandbox();

    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.runtime.ready" }, "https://example.com", null));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBeUndefined();
  });

  it("once captured, iframeSource does not change", () => {
    const { sandbox } = createSandbox();
    const firstWindow = {} as Window;
    const secondWindow = {} as Window;

    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.runtime.ready" }, "https://first.example.com", firstWindow));
    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.req.callAI" }, "https://second.example.com", secondWindow));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBe(firstWindow);
    expect(internal.iframeOrigin).toBe("https://first.example.com");
  });

  it("forwardDocChangedToIframe delivers to captured source", () => {
    const { sandbox } = createSandbox();
    const messages: { data: unknown; origin: string }[] = [];
    const fakeWindow = {
      postMessage: (data: unknown, origin: string) => {
        messages.push({ data, origin });
      },
    } as unknown as Window;

    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.runtime.ready" }, "https://app--user.example.com", fakeWindow));

    sandbox.forwardDocChangedToIframe("jchris", "quick-doc-saver", "doc123");

    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual({
      type: "vibes.diy.evt-doc-changed",
      userSlug: "jchris",
      appSlug: "quick-doc-saver",
      docId: "doc123",
    });
    expect(messages[0].origin).toBe("https://app--user.example.com");
  });

  it("forwardDocChangedToIframe is a no-op before iframe ready", () => {
    const { sandbox } = createSandbox();

    // No messages sent yet — iframeSource is undefined
    sandbox.forwardDocChangedToIframe("jchris", "quick-doc-saver", "doc123");

    // Should not throw — silently drops
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sandbox as any).iframeSource).toBeUndefined();
  });

  it("Clerk-then-sandbox sequence captures sandbox correctly", () => {
    const { sandbox } = createSandbox();
    const clerkWindow = {} as Window;
    const sandboxWindow = {} as Window;

    // Clerk sends first (wrong source)
    sandbox.handleMessage(fakeMessageEvent({ type: "__clerk_handshake" }, "https://vibes.diy", clerkWindow));

    // Sandbox sends second (correct source)
    sandbox.handleMessage(fakeMessageEvent({ type: "vibe.runtime.ready" }, "https://app--user.vibesdiy.net", sandboxWindow));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = sandbox as any;
    expect(internal.iframeSource).toBe(sandboxWindow);
    expect(internal.iframeOrigin).toBe("https://app--user.vibesdiy.net");
  });
});
