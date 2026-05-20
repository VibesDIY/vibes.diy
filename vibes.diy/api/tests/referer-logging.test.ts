import { afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";
import { TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { cfServe, CFInject, isInternalReferer, noopCache, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

describe("isInternalReferer", () => {
  it("suppresses vibes.diy exact match", () => {
    expect(isInternalReferer("vibes.diy")).toBe(true);
  });

  it("suppresses *.vibesdiy.net subdomains", () => {
    expect(isInternalReferer("prod-v2.vibesdiy.net")).toBe(true);
    expect(isInternalReferer("assets.prod-v2.vibesdiy.net")).toBe(true);
  });

  it("suppresses *.workers.dev subdomains", () => {
    expect(isInternalReferer("vibes.workers.dev")).toBe(true);
  });

  it("passes through good.vibes.diy (user-app subdomain)", () => {
    expect(isInternalReferer("good.vibes.diy")).toBe(false);
  });

  it("passes through external sites", () => {
    expect(isInternalReferer("github.com")).toBe(false);
    expect(isInternalReferer("google.com")).toBe(false);
  });
});

describe("cfServe referer logging", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let serveCtx: ExecutionContext & CFInject;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const wsPair = TestWSPair.create();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    serveCtx = {
      appCtx: appCtx.appCtx,
      cache: noopCache,
      drizzle: appCtx.vibesCtx.sql.db,
      webSocket: {
        connections: new Set(),
        webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }),
      },
    } as unknown as ExecutionContext & CFInject;
  });

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log");
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function refererCalls(): unknown[][] {
    return consoleSpy.mock.calls.filter((c: unknown[]) => typeof c[0] === "string" && c[0].startsWith("[referer]"));
  }

  async function fetchWithReferer(referer: string): Promise<void> {
    const req = new Request("https://vibes.diy/api/auth/session", {
      headers: { Referer: referer },
    }) as unknown as CFRequest;
    await cfServe(req, serveCtx).catch((_e: unknown) => undefined);
  }

  it("logs an external referer", async () => {
    await fetchWithReferer("https://good.vibes.diy/house-rules");
    expect(refererCalls()).toHaveLength(1);
    expect(refererCalls()[0][0]).toBe("[referer]");
    expect(String(refererCalls()[0][1])).toContain("good.vibes.diy");
  });

  it("suppresses vibes.diy same-site referer", async () => {
    await fetchWithReferer("https://vibes.diy/");
    expect(refererCalls()).toHaveLength(0);
  });

  it("suppresses *.vibesdiy.net internal referer", async () => {
    await fetchWithReferer("https://assets.prod-v2.vibesdiy.net/");
    expect(refererCalls()).toHaveLength(0);
  });

  it("suppresses same-hostname referer", async () => {
    await fetchWithReferer("https://vibes.diy/some-other-page");
    expect(refererCalls()).toHaveLength(0);
  });
});
