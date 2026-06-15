import { beforeAll, describe, expect, it } from "vitest";
import { Result } from "@adviser/cement";
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

// A hand-written vibeApi that records queryDocs calls and its onDocChanged
// subscription lifecycle. No mocking framework — the rules-bag forbids it.
function makeFakeVibeApi(): {
  api: VibesDiyApiIface;
  queryDocsCalls: { count: number };
  onDocChanged: { subscribed: number; unsubscribed: number };
} {
  const queryDocsCalls = { count: 0 };
  const onDocChanged = { subscribed: 0, unsubscribed: 0 };
  const api: Partial<VibesDiyApiIface> = {
    queryDocs: async () => {
      queryDocsCalls.count++;
      return Result.Ok({
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs: [{ _id: "d1", title: "from vibeApi" }],
      });
    },
    onDocChanged: () => {
      onDocChanged.subscribed++;
      return () => {
        onDocChanged.unsubscribed++;
      };
    },
  };
  return { api: api as VibesDiyApiIface, queryDocsCalls, onDocChanged };
}

function makeSandbox(vibeApi?: VibesDiyApiIface): { sandbox: vibesDiySrvSandbox; captured: CapturedMsg[]; iframe: Window } {
  const captured: CapturedMsg[] = [];
  const iframe = { postMessage: (data: unknown, origin: string) => captured.push({ data, origin }) } as unknown as Window;
  const fakeChatApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
  };
  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeChatApi as VibesDiyApiIface,
    ...(vibeApi ? { vibeApi } : {}),
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
  return { sandbox, captured, iframe };
}

function queryDocsMsg(iframe: Window): MessageEvent {
  return fakeMessageEvent(
    { type: "vibes.diy.req-query-docs", tid: "q1", appSlug: "myapp", ownerHandle: "alice", dbName: "notes" },
    "https://myapp--alice.example.com",
    iframe
  );
}

describe("srv-sandbox resolves vibeApi live (issue #2348)", () => {
  it("routes queryDocs to a vibeApi attached AFTER construction", async () => {
    // Reproduces the cold-load / SPA-nav race: the singleton sandbox is built
    // on a render where vibeApi is undefined, then vibeApi becomes available.
    const { sandbox, captured, iframe } = makeSandbox(undefined);
    const { api, queryDocsCalls } = makeFakeVibeApi();

    sandbox.setVibeApi(api);

    sandbox.handleMessage(queryDocsMsg(iframe));
    await new Promise((r) => setTimeout(r, 50));

    expect(queryDocsCalls.count).toBe(1);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-query-docs");
    expect(msg?.data).toMatchObject({ tid: "q1", type: "vibes.diy.res-query-docs", status: "ok" });
    expect((msg?.data as { message?: string }).message ?? "").not.toMatch(/vibeApi/i);
  });

  it("still errors when vibeApi has been cleared back to undefined", async () => {
    const { api } = makeFakeVibeApi();
    const { sandbox, captured, iframe } = makeSandbox(api);

    sandbox.setVibeApi(undefined);

    sandbox.handleMessage(queryDocsMsg(iframe));
    await new Promise((r) => setTimeout(r, 50));

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-query-docs");
    expect(msg?.data).toMatchObject({ tid: "q1", type: "vibes.diy.res-query-docs", status: "error" });
    // Single error path, but diagnosable: names the owner/app the request carried.
    expect((msg?.data as { message?: string }).message ?? "").toMatch(/vibeApi/i);
    expect((msg?.data as { message?: string }).message ?? "").toContain("alice/myapp");
  });

  it("wires onDocChanged forwarding to a vibeApi attached after construction", () => {
    const { sandbox } = makeSandbox(undefined);
    const { api, onDocChanged } = makeFakeVibeApi();

    sandbox.setVibeApi(api);

    expect(onDocChanged.subscribed).toBe(1);
  });

  it("unsubscribes the previous onDocChanged when vibeApi is swapped", () => {
    const first = makeFakeVibeApi();
    const second = makeFakeVibeApi();
    const { sandbox } = makeSandbox(first.api);

    expect(first.onDocChanged.subscribed).toBe(1);
    sandbox.setVibeApi(second.api);

    expect(first.onDocChanged.unsubscribed).toBe(1);
    expect(second.onDocChanged.subscribed).toBe(1);
  });

  it("setVibeApi with the same reference is a no-op (no re-subscribe)", () => {
    const { api, onDocChanged } = makeFakeVibeApi();
    const { sandbox } = makeSandbox(api);

    expect(onDocChanged.subscribed).toBe(1);
    sandbox.setVibeApi(api);

    expect(onDocChanged.subscribed).toBe(1);
    expect(onDocChanged.unsubscribed).toBe(0);
  });
});
