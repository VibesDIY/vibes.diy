import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface } from "@vibes.diy/api-types";

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function setupNoVibeApi(): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
  putDocCalls: { count: number };
} {
  const captured: CapturedMsg[] = [];
  const iframe = { postMessage: (data: unknown, origin: string) => captured.push({ data, origin }) } as unknown as Window;
  const putDocCalls = { count: 0 };
  const fakeChatApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    putDoc: async () => {
      putDocCalls.count++; // MUST stay 0 — a missing vibeApi must NOT fall back to chatApi
      throw new Error("chatApi.putDoc should never be called on the vibe-data path");
    },
  };
  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeChatApi as VibesDiyApiIface,
    errorLogger: () => {
      /* noop */
    },
    eventListeners: {
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
    },
  });
  return { sandbox, captured, iframe, putDocCalls };
}

describe("srv-sandbox vibe-data handlers require vibeApi", () => {
  it("putDoc with no vibeApi returns a typed error and never touches chatApi", async () => {
    const { sandbox, captured, iframe, putDocCalls } = setupNoVibeApi();
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibes.diy.req-put-doc", tid: "t1", appSlug: "myapp", ownerHandle: "alice", dbName: "notes", doc: { title: "hi" } },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(putDocCalls.count).toBe(0);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-put-doc");
    expect(msg?.data).toMatchObject({ tid: "t1", type: "vibes.diy.res-put-doc", status: "error" });
    expect((msg?.data as { message?: string }).message ?? "").toMatch(/vibeApi/i);
  });

  it("imgGen with no vibeApi returns a typed error", async () => {
    const { sandbox, captured, iframe } = setupNoVibeApi();
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.imgGen", tid: "g1", appSlug: "myapp", ownerHandle: "alice", prompt: "a cat" },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.imgGen");
    expect(msg?.data).toMatchObject({ tid: "g1", type: "vibe.res.imgGen", status: "error" });
  });

  it("does not register a chatApi.onDocChanged forwarder (dead path)", () => {
    let chatOnDocChangedCalls = 0;
    let vibeOnDocChangedCalls = 0;
    const fakeChatApi: Partial<VibesDiyApiIface> = {
      onDocChanged: () => {
        chatOnDocChangedCalls++;
        return () => {
          /* noop */
        };
      },
    };
    const fakeVibeApi: Partial<VibesDiyApiIface> = {
      onDocChanged: () => {
        vibeOnDocChangedCalls++;
        return () => {
          /* noop */
        };
      },
    };
    const _sandbox = new vibesDiySrvSandbox({
      chatApi: fakeChatApi as VibesDiyApiIface,
      vibeApi: fakeVibeApi as VibesDiyApiIface,
      errorLogger: () => {
        /* noop */
      },
      eventListeners: {
        addEventListener: () => {
          /* noop */
        },
        removeEventListener: () => {
          /* noop */
        },
      },
    });
    expect(_sandbox).toBeDefined();
    expect(chatOnDocChangedCalls).toBe(0);
    expect(vibeOnDocChangedCalls).toBe(1);
  });
});
