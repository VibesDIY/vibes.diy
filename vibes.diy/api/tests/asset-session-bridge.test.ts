import { beforeAll, describe, expect, it } from "vitest";
import { TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { processRequest, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Bridge-endpoint tests. /_auth/session takes a Clerk Bearer in the
// Authorization header and returns Set-Cookie:vibes-asset-session=<jwt>.
// /_auth/logout returns a Max-Age=0 clearing Set-Cookie. Credentialed CORS
// (Allow-Origin reflects request Origin, Allow-Credentials: true) is
// required because the parent shell at vibes.diy POSTs cross-origin to
// the asset host.

async function setupCtx() {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA);
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

function bridgeUrl(svc: { hostnameBase: string; protocol: string; port?: string }, path: string): string {
  const port = svc.port && svc.port !== "80" && svc.port !== "443" ? `:${svc.port}` : "";
  return `${svc.protocol}://assets.${svc.hostnameBase.replace(/^\./, "")}${port}${path}`;
}

describe("asset-session bridge", { timeout: 60000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let svc: { hostnameBase: string; protocol: string; port?: string };
  let userToken: string;

  beforeAll(async () => {
    const { ctx: c, sthis, deviceCA } = await setupCtx();
    ctx = c;
    svc = c.vibesCtx.params.vibes.svc;
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 900 });
    userToken = (await user.getDashBoardToken()).token;
  }, 60000);

  it("POST /_auth/session with valid Bearer mints a cookie", async () => {
    const url = bridgeUrl(svc, "/_auth/session");
    const res = await processRequest(
      ctx.appCtx,
      new Request(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}`, Origin: "https://vibes.diy" },
      })
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^vibes-asset-session=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=None");
    expect(setCookie).toContain("Partitioned");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toMatch(/Max-Age=\d+/);
    // credentialed CORS — reflect Origin, allow credentials
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://vibes.diy");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toContain("Origin");
    const body = await res.json();
    expect(body.type).toBe("vibes.diy.res-auth-session");
    expect(typeof body.maxAge).toBe("number");
    expect(body.maxAge).toBeGreaterThan(0);
  });

  it("POST /_auth/session without Bearer returns 401", async () => {
    const url = bridgeUrl(svc, "/_auth/session");
    const res = await processRequest(ctx.appCtx, new Request(url, { method: "POST", headers: { Origin: "https://vibes.diy" } }));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeFalsy();
  });

  it("POST /_auth/session with garbage Bearer returns 401", async () => {
    const url = bridgeUrl(svc, "/_auth/session");
    const res = await processRequest(
      ctx.appCtx,
      new Request(url, {
        method: "POST",
        headers: { Authorization: "Bearer not-a-real-token", Origin: "https://vibes.diy" },
      })
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeFalsy();
  });

  it("POST /_auth/logout returns clearing Set-Cookie", async () => {
    const url = bridgeUrl(svc, "/_auth/logout");
    const res = await processRequest(ctx.appCtx, new Request(url, { method: "POST", headers: { Origin: "https://vibes.diy" } }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^vibes-asset-session=;/);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=None");
    expect(setCookie).toContain("Partitioned");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://vibes.diy");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("OPTIONS /_auth/session preflight reflects Origin + credentials", async () => {
    const url = bridgeUrl(svc, "/_auth/session");
    const res = await processRequest(
      ctx.appCtx,
      new Request(url, {
        method: "OPTIONS",
        headers: {
          Origin: "https://vibes.diy",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://vibes.diy");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Vary")).toContain("Origin");
  });
});
