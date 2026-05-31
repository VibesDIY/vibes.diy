import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface, ResAssetUploadGrant, VibesDiyError } from "@vibes.diy/api-types";
import { Future, Result } from "@adviser/cement";

// Stage B Phase 5 host-side handler `vibePutAsset`. Dependencies are
// injected (fetch + vibeDiyApi) so the handler is testable without
// stubbing globals or mocking modules — see agents/rules-bag.md "Never
// use mocking". `vi.useFakeTimers` is OK; it controls test-environment
// time, not behavior.

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

afterEach(() => {
  vi.useRealTimers();
});

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function setupSandbox(opts: {
  grantResult: Result<ResAssetUploadGrant, VibesDiyError>;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
  fetchCalls: FetchCall[];
  grantCalls: { count: number };
} {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const grantCalls = { count: 0 };
  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    requestAssetUploadGrant: async () => {
      grantCalls.count++;
      return opts.grantResult;
    },
  };

  const fetchCalls: FetchCall[] = [];
  const fetchImpl = opts.fetchImpl ?? (async () => new Response("default-not-used", { status: 200 }));
  const trackedFetch: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    return fetchImpl(input, init);
  }) as typeof fetch;

  const sandbox = new vibesDiySrvSandbox({
    vibeDiyApi: fakeApi as VibesDiyApiIface,
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
    fetch: trackedFetch,
  });
  return { sandbox, captured, iframe, fetchCalls, grantCalls };
}

describe("vibePutAsset host handler", () => {
  it("happy path — mints grant, POSTs blob, returns ok response with cid + uploadId", async () => {
    const { sandbox, captured, iframe, fetchCalls, grantCalls } = setupSandbox({
      grantResult: Result.Ok({
        type: "vibes.diy.res-asset-upload-grant" as const,
        uploadUrl: "https://api.example.test/assets",
        grant: "fake-grant-jwt",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        uploadId: "upl-test-1",
      }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            type: "vibes.diy.res-put-asset",
            cid: "cid-test-1",
            getURL: "s3://r2/cid-test-1",
            size: 11,
            uploadId: "upl-test-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ),
    });

    const blob = new Blob(["hello world"], { type: "text/plain" });
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.putAsset", tid: "tid-1", ownerHandle: "alice", appSlug: "notes", blob },
        "https://notes--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(grantCalls.count).toBe(1);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("https://api.example.test/assets");
    expect(fetchCalls[0].init.method).toBe("POST");
    expect(fetchCalls[0].init.headers).toMatchObject({ "X-Asset-Grant": "fake-grant-jwt" });

    const finalMsg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.putAsset");
    expect(finalMsg?.data).toMatchObject({
      tid: "tid-1",
      type: "vibe.res.putAsset",
      status: "ok",
      cid: "cid-test-1",
      uploadId: "upl-test-1",
    });
  });

  it("returns error response when grant minting fails", async () => {
    const { sandbox, captured, iframe, fetchCalls, grantCalls } = setupSandbox({
      grantResult: Result.Err<ResAssetUploadGrant, VibesDiyError>({
        type: "vibes.diy.res-error",
        name: "VibesDiyError",
        message: "access denied",
      } as VibesDiyError),
    });

    const blob = new Blob(["x"], { type: "text/plain" });
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.putAsset", tid: "tid-2", ownerHandle: "alice", appSlug: "notes", blob },
        "https://notes--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 20));

    expect(grantCalls.count).toBe(1);
    expect(fetchCalls).toHaveLength(0);
    const finalMsg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.putAsset");
    expect(finalMsg?.data).toMatchObject({
      tid: "tid-2",
      type: "vibe.res.putAsset",
      status: "error",
    });
    expect((finalMsg?.data as { message: string }).message).toContain("grant minting failed");
  });

  it("returns error response when POST /assets returns non-2xx", async () => {
    const { sandbox, captured, iframe } = setupSandbox({
      grantResult: Result.Ok({
        type: "vibes.diy.res-asset-upload-grant" as const,
        uploadUrl: "https://api.example.test/assets",
        grant: "g",
        expiresAt: new Date().toISOString(),
        uploadId: "u",
      }),
      fetchImpl: async () => new Response("upload broke", { status: 500 }),
    });

    const blob = new Blob(["x"], { type: "text/plain" });
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.putAsset", tid: "tid-3", ownerHandle: "alice", appSlug: "notes", blob },
        "https://notes--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 30));

    const finalMsg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.putAsset");
    expect(finalMsg?.data).toMatchObject({
      tid: "tid-3",
      type: "vibe.res.putAsset",
      status: "error",
    });
    expect((finalMsg?.data as { message: string }).message).toContain("500");
  });

  it("emits progress heartbeats every ~3s during upload to keep idle-reset alive", async () => {
    vi.useFakeTimers();
    const fetchPromise = new Future<Response>();
    const { sandbox, captured, iframe } = setupSandbox({
      grantResult: Result.Ok({
        type: "vibes.diy.res-asset-upload-grant" as const,
        uploadUrl: "https://api.example.test/assets",
        grant: "g",
        expiresAt: new Date().toISOString(),
        uploadId: "upl-progress",
      }),
      fetchImpl: () => fetchPromise.asPromise(),
    });

    const blob = new Blob(["bytes"], { type: "text/plain" });
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.putAsset", tid: "tid-progress", ownerHandle: "alice", appSlug: "notes", blob },
        "https://notes--alice.example.com",
        iframe
      )
    );
    // Yield until the handler reaches the fetch await + setInterval setup.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Advance 7 seconds — expect ≥2 progress heartbeats.
    await vi.advanceTimersByTimeAsync(7000);
    const progressMsgs = captured.filter((c) => (c.data as { type?: string }).type === "vibe.evt.putAsset.progress");
    expect(progressMsgs.length).toBeGreaterThanOrEqual(2);
    for (const p of progressMsgs) {
      expect(p.data).toMatchObject({ tid: "tid-progress", type: "vibe.evt.putAsset.progress" });
    }

    // Resolve the fetch — heartbeat should stop, final res.putAsset arrives.
    fetchPromise.resolve(
      new Response(JSON.stringify({ cid: "c", getURL: "s3://r2/c", size: 5, uploadId: "upl-progress" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await vi.advanceTimersByTimeAsync(50);
    const final = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.putAsset");
    expect(final?.data).toMatchObject({ tid: "tid-progress", status: "ok" });
  });
});
