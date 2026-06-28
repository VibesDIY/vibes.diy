// Browser dash-client smoke test (de-fireproof Task 6.2).
//
// `dash-client.ts` is lifted verbatim from core-protocols-dashboard. These tests
// pin the two behaviors that matter for the lift: (1) a request method issues the
// expected single PUT with the Clerk token injected as `auth`, and (2) the client
// passes the token through OPAQUELY — it never decodes/validates the JWT, so it
// carries none of the strict-claim-decode bug class that bit Task 5.
import { describe, it, expect } from "vitest";
import { clerkDashApi, DashboardApiImpl, type LoadedClerkLike } from "./dash-client.js";

function fakeClerk(token: string): LoadedClerkLike {
  return {
    addListener(cb) {
      cb({ session: { getToken: async () => token } });
      return () => {};
    },
  };
}

describe("dash-client (owned browser dashboard HTTP client)", () => {
  it("clerkDashApi returns a DashboardApiImpl", () => {
    const api = clerkDashApi(fakeClerk("t"), {
      apiUrl: "https://dash.test/api/unique-1",
      fetch: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch,
    });
    expect(api).toBeInstanceOf(DashboardApiImpl);
  });

  it("issues a single PUT with the Clerk token injected as auth, body is the request DTO", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const api = clerkDashApi(fakeClerk("clerk-token-abc"), {
      apiUrl: "https://dash.test/api/unique-2",
      fetch: (async (url: string, init: RequestInit) => {
        captured = { url, init };
        return { ok: true, json: async () => ({ type: "resEnsureUser", userExisted: false }) };
      }) as unknown as typeof fetch,
    });

    const res = await api.ensureUser({} as never);
    expect(res.isOk()).toBe(true);

    expect(captured?.url).toBe("https://dash.test/api/unique-2");
    expect(captured?.init.method).toBe("PUT");
    const body = JSON.parse(captured?.init.body as string);
    expect(body.type).toBe("reqEnsureUser");
    // The token is injected verbatim — never parsed or re-shaped.
    expect(body.auth).toEqual({ type: "clerk", token: "clerk-token-abc" });
  });

  it("surfaces a non-ok HTTP response as a Result.Err", async () => {
    const api = clerkDashApi(fakeClerk("t"), {
      apiUrl: "https://dash.test/api/unique-3",
      fetch: (async () => ({ ok: false, status: 403, statusText: "Forbidden", text: async () => "nope" })) as unknown as typeof fetch,
    });
    const res = await api.findUser({} as never);
    expect(res.isErr()).toBe(true);
  });
});
