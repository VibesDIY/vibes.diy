import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Result } from "@adviser/cement";
import { ensureAssetSession, tearDownAssetSession, __resetAssetSessionCacheForTests } from "../../pkg/app/lib/asset-session.js";

// Unit tests for the parent-shell asset-session helper.
//
// What we're proving:
// - bridge POST hits assets.<base>/_auth/session with credentials + Bearer
// - Result.Ok on 200; cache dedups concurrent calls
// - tearDownAssetSession unsets the cache so next ensure refetches
// - non-clerk auth types succeed silently (no bridge POST)
// - getToken errors don't pin the cache (next caller retries)
//
// No mocking — `fetch` is a real architectural seam on `ensureAssetSession`.
// We hand it a typed function literal; that's a fake implementation, not a mock.

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

interface FakeFetcherSpy {
  readonly fetch: typeof fetch;
  readonly calls: readonly FetchCall[];
}

function fakeFetcher(impl: (call: FetchCall) => Promise<Response>): FakeFetcherSpy {
  const calls: FetchCall[] = [];
  const fn: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return impl({ url, init });
  };
  return { fetch: fn, calls };
}

function okSession(maxAge = 600): Response {
  return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  __resetAssetSessionCacheForTests();
});

afterEach(() => {
  __resetAssetSessionCacheForTests();
});

describe("ensureAssetSession", () => {
  it("POSTs to assets.<base>/_auth/session with credentials + Bearer header on success", async () => {
    const spy = fakeFetcher(async () => okSession());
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "tok-abc" }),
      hostnameBase: "cli-v2.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r.isOk()).toBe(true);
    expect(spy.calls).toHaveLength(1);
    // Port (when present) is reused from the runtime origin so dev hosts on
    // a non-standard Vite port (e.g. :8888) bridge to assets.<base>:<port>.
    // In a default-port runtime, no port is appended.
    const expectedPort = globalThis.location?.port ? `:${globalThis.location.port}` : "";
    expect(spy.calls[0].url).toBe(`https://assets.cli-v2.vibesdiy.net${expectedPort}/_auth/session`);
    const init = spy.calls[0].init;
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-abc");
  });

  it("dedups concurrent calls — second caller shares the in-flight promise", async () => {
    const spy = fakeFetcher(async () => {
      // Hold the response open briefly so the second call lands while the first is in-flight.
      await new Promise((resolve) => setTimeout(resolve, 10));
      return okSession();
    });
    const a = ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-1.vibesdiy.net",
      fetch: spy.fetch,
    });
    const b = ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-1.vibesdiy.net",
      fetch: spy.fetch,
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.isOk()).toBe(true);
    expect(rb.isOk()).toBe(true);
    expect(spy.calls).toHaveLength(1);
  });

  it("getToken error → Result.Err, cache resets so next call retries", async () => {
    const spy = fakeFetcher(async () => okSession());
    let getTokenCalls = 0;
    const r1 = await ensureAssetSession({
      getToken: async () => {
        getTokenCalls++;
        return Result.Err("not signed in");
      },
      hostnameBase: "test-2.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r1.isErr()).toBe(true);
    expect(spy.calls).toHaveLength(0);

    // Second call must retry (cache reset on error).
    const r2 = await ensureAssetSession({
      getToken: async () => {
        getTokenCalls++;
        return Result.Ok({ type: "clerk", token: "t-late" });
      },
      hostnameBase: "test-2.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r2.isOk()).toBe(true);
    expect(getTokenCalls).toBe(2);
    expect(spy.calls).toHaveLength(1);
  });

  it("non-clerk auth types succeed silently without bridge POST", async () => {
    const spy = fakeFetcher(async () => okSession());
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "device-id", token: "device-token" }),
      hostnameBase: "test-3.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r.isOk()).toBe(true);
    expect(spy.calls).toHaveLength(0);
  });

  it("non-200 response → Result.Err", async () => {
    const spy = fakeFetcher(async () => new Response("Unauthorized", { status: 401 }));
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "bad" }),
      hostnameBase: "test-4.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r.isErr()).toBe(true);
  });

  it("malformed response body → Result.Err", async () => {
    const spy = fakeFetcher(async () => new Response("not json", { status: 200 }));
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-5.vibesdiy.net",
      fetch: spy.fetch,
    });
    expect(r.isErr()).toBe(true);
  });
});

describe("tearDownAssetSession", () => {
  it("POSTs to /_auth/logout with credentials and unsets the cache", async () => {
    const spy = fakeFetcher(async ({ url }) => {
      if (url.endsWith("/_auth/session")) return okSession();
      return new Response("{}", { status: 200 });
    });
    // Prime the cache.
    await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-6.vibesdiy.net",
      fetch: spy.fetch,
    });
    await tearDownAssetSession({ hostnameBase: "test-6.vibesdiy.net", fetch: spy.fetch });
    expect(spy.calls.some((c) => c.url.endsWith("/_auth/logout"))).toBe(true);

    // Next ensure call must refetch (cache cleared by tearDown).
    const refetchSpy = fakeFetcher(async () => okSession());
    await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t2" }),
      hostnameBase: "test-6.vibesdiy.net",
      fetch: refetchSpy.fetch,
    });
    expect(refetchSpy.calls).toHaveLength(1);
  });

  it("logout fetch failure does not throw", async () => {
    const spy = fakeFetcher(async () => {
      throw new Error("network down");
    });
    await expect(tearDownAssetSession({ hostnameBase: "test-7.vibesdiy.net", fetch: spy.fetch })).resolves.toBeUndefined();
  });
});
