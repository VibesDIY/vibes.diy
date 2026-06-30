import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// #2772 D3 — listVersions: owner sees all rows; non-owner sees only production.
describe("listVersions", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // non-owner
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 500 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();
    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: { connections: new Set(), webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }) },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });
    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 600 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  async function version(opts: { appSlug?: string; mode: "dev" | "production"; tag: string }) {
    const rRes = await api.ensureAppSlug({
      ...(opts.appSlug ? { appSlug: opts.appSlug } : {}),
      mode: opts.mode,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>${opts.tag}</div>;} App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail(`Expected ensureAppSlug (${opts.mode}) ok`);
    return res;
  }

  it("lists all rows for the owner (dev + production) and marks the published one", async () => {
    const now = sthis.nextId(8).str;
    const prod = await version({ mode: "production", tag: `pub ${now}` });
    const { appSlug, ownerHandle } = prod;
    await version({ appSlug, mode: "dev", tag: `draft ${now}` });

    const rList = await api.listVersions({ appSlug, ownerHandle });
    if (rList.isErr()) assert.fail("Expected listVersions to succeed: " + JSON.stringify(rList.Err()));
    const items = rList.Ok().items;
    expect(items.length).toBe(2);
    expect(items.some((i) => i.mode === "dev")).toBe(true);
    expect(items.some((i) => i.mode === "production")).toBe(true);
    // Exactly one published row — the top production.
    const published = items.filter((i) => i.published);
    expect(published.length).toBe(1);
    expect(published[0].mode).toBe("production");
  });

  it("hides dev drafts from a non-owner (only production rows)", async () => {
    const now = sthis.nextId(8).str;
    const prod = await version({ mode: "production", tag: `pub ${now}` });
    const { appSlug, ownerHandle } = prod;
    await version({ appSlug, mode: "dev", tag: `draft ${now}` });

    const rList = await api2.listVersions({ appSlug, ownerHandle });
    if (rList.isErr()) assert.fail("Expected listVersions to succeed: " + JSON.stringify(rList.Err()));
    const items = rList.Ok().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.mode === "production")).toBe(true); // no draft leak
  });
});
