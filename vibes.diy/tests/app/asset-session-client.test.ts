import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function mkFakeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

beforeEach(() => {
  __resetAssetSessionCacheForTests();
});

afterEach(() => {
  __resetAssetSessionCacheForTests();
});

describe("ensureAssetSession", () => {
  it("POSTs to assets.<base>/_auth/session with credentials + Bearer header on success", async () => {
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const fakeFetch = mkFakeFetch(async (url, init) => {
      observedUrl = url;
      observedInit = init;
      return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: 600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "tok-abc" }),
      hostnameBase: "cli-v2.vibesdiy.net",
      fetch: fakeFetch,
    });
    expect(r.isOk()).toBe(true);
    expect(observedUrl).toBe("https://assets.cli-v2.vibesdiy.net/_auth/session");
    expect(observedInit?.method).toBe("POST");
    expect(observedInit?.credentials).toBe("include");
    const headers = observedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-abc");
  });

  it("dedups concurrent calls — second caller shares the in-flight promise", async () => {
    let calls = 0;
    const fakeFetch = mkFakeFetch(async () => {
      calls++;
      // Hold the response open briefly so the second call lands while the first is in-flight.
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: 600 }), { status: 200 });
    });
    const a = ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-1.vibesdiy.net",
      fetch: fakeFetch,
    });
    const b = ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-1.vibesdiy.net",
      fetch: fakeFetch,
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.isOk()).toBe(true);
    expect(rb.isOk()).toBe(true);
    expect(calls).toBe(1);
  });

  it("getToken error → Result.Err, cache resets so next call retries", async () => {
    let getTokenCalls = 0;
    let fetchCalls = 0;
    const fakeFetch = mkFakeFetch(async () => {
      fetchCalls++;
      return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: 600 }), { status: 200 });
    });
    const r1 = await ensureAssetSession({
      getToken: async () => {
        getTokenCalls++;
        return Result.Err("not signed in");
      },
      hostnameBase: "test-2.vibesdiy.net",
      fetch: fakeFetch,
    });
    expect(r1.isErr()).toBe(true);
    expect(fetchCalls).toBe(0);

    // Second call must retry (cache reset on error).
    const r2 = await ensureAssetSession({
      getToken: async () => {
        getTokenCalls++;
        return Result.Ok({ type: "clerk", token: "t-late" });
      },
      hostnameBase: "test-2.vibesdiy.net",
      fetch: fakeFetch,
    });
    expect(r2.isOk()).toBe(true);
    expect(getTokenCalls).toBe(2);
    expect(fetchCalls).toBe(1);
  });

  it("non-clerk auth types succeed silently without bridge POST", async () => {
    const fakeFetch = vi.fn();
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "device-id", token: "device-token" }),
      hostnameBase: "test-3.vibesdiy.net",
      fetch: fakeFetch as unknown as typeof fetch,
    });
    expect(r.isOk()).toBe(true);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("non-200 response → Result.Err", async () => {
    const fakeFetch = mkFakeFetch(async () => new Response("Unauthorized", { status: 401 }));
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "bad" }),
      hostnameBase: "test-4.vibesdiy.net",
      fetch: fakeFetch,
    });
    expect(r.isErr()).toBe(true);
  });

  it("malformed response body → Result.Err", async () => {
    const fakeFetch = mkFakeFetch(async () => new Response("not json", { status: 200 }));
    const r = await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-5.vibesdiy.net",
      fetch: fakeFetch,
    });
    expect(r.isErr()).toBe(true);
  });
});

describe("tearDownAssetSession", () => {
  it("POSTs to /_auth/logout with credentials and unsets the cache", async () => {
    const fetched: string[] = [];
    const fakeFetch = mkFakeFetch(async (url) => {
      fetched.push(url);
      if (url.endsWith("/_auth/session")) {
        return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: 600 }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    // Prime the cache.
    await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t" }),
      hostnameBase: "test-6.vibesdiy.net",
      fetch: fakeFetch,
    });
    await tearDownAssetSession({ hostnameBase: "test-6.vibesdiy.net", fetch: fakeFetch });
    expect(fetched.some((u) => u.endsWith("/_auth/logout"))).toBe(true);

    // Next ensure call must refetch (cache cleared by tearDown).
    let refetched = false;
    await ensureAssetSession({
      getToken: async () => Result.Ok({ type: "clerk", token: "t2" }),
      hostnameBase: "test-6.vibesdiy.net",
      fetch: mkFakeFetch(async () => {
        refetched = true;
        return new Response(JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: 600 }), { status: 200 });
      }),
    });
    expect(refetched).toBe(true);
  });

  it("logout fetch failure does not throw", async () => {
    const fakeFetch = mkFakeFetch(async () => {
      throw new Error("network down");
    });
    await expect(tearDownAssetSession({ hostnameBase: "test-7.vibesdiy.net", fetch: fakeFetch })).resolves.toBeUndefined();
  });
});
