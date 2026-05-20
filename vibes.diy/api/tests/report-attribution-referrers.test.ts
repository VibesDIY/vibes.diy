import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createTestUserWithPublicMeta } from "./create-test-user-with-public-meta.js";

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

describe("report-attribution-referrers", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let apiAttrib: VibesDiyApi;
  let apiEmpty: VibesDiyApi;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    function makeApi(token: { type: "device-id"; token: string }): VibesDiyApi {
      return new VibesDiyApi({
        apiUrl: "http://localhost:8787/api",
        ws: wsPair.p1 as unknown as WebSocket,
        fetch: fetchPair.client.fetch,
        timeoutMs: 100000,
        getToken: async () => Result.Ok(token),
      });
    }

    const userAttrib = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-attrib",
      publicMeta: { reports: ["attribution"] },
    });
    apiAttrib = makeApi(await userAttrib.getDashBoardToken());

    const userEmpty = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-attrib-empty",
      publicMeta: { reports: [] },
    });
    apiEmpty = makeApi(await userEmpty.getDashBoardToken());

    // Seed referrer events:
    //   app-a: 2 hits from example.com/page1, 1 hit from example.com/page2
    //   app-b: 3 hits from example.com/page1
    //   root /: 1 hit from example.com/page1
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.refererEvents).values([
      {
        logKey: "log-1",
        lineIdx: 0,
        ts: "2025-01-01T00:00:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-a",
      },
      {
        logKey: "log-1",
        lineIdx: 1,
        ts: "2025-01-01T00:01:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-a",
      },
      {
        logKey: "log-1",
        lineIdx: 2,
        ts: "2025-01-01T00:02:00Z",
        refHref: "https://example.com/page2",
        refHost: "example.com",
        refPath: "/page2",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-a",
      },
      {
        logKey: "log-1",
        lineIdx: 3,
        ts: "2025-01-01T00:03:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-b",
      },
      {
        logKey: "log-1",
        lineIdx: 4,
        ts: "2025-01-01T00:04:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-b",
      },
      {
        logKey: "log-1",
        lineIdx: 5,
        ts: "2025-01-01T00:05:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/vibe/alice/app-b",
      },
      {
        logKey: "log-1",
        lineIdx: 6,
        ts: "2025-01-01T00:06:00Z",
        refHref: "https://example.com/page1",
        refHost: "example.com",
        refPath: "/page1",
        reqMethod: "GET",
        reqPath: "/",
      },
    ]);
  }, TIMEOUT);

  describe("auth gate", () => {
    it("no attribution grant → not authorized", async () => {
      const r = await apiEmpty.reportAttributionReferrers({});
      expect(r.isErr()).toBe(true);
      const err = r.Err() as { code?: string };
      expect(err.code).toBe("report-not-authorized");
    });
  });

  describe("global view (no filter)", () => {
    it("returns all rows, each with a reqPath field", async () => {
      const r = await apiAttrib.reportAttributionReferrers({});
      expect(r.isOk()).toBe(true);
      const body = r.Ok();
      expect(body.type).toBe("vibes.diy.res-report-attribution-referrers");
      // 4 distinct (refHost, refPath, reqPath) groups:
      //   (example.com, /page1, /vibe/alice/app-a) → 2
      //   (example.com, /page2, /vibe/alice/app-a) → 1
      //   (example.com, /page1, /vibe/alice/app-b) → 3
      //   (example.com, /page1, /)                 → 1
      expect(body.rows).toHaveLength(4);
      for (const row of body.rows) {
        expect(typeof row.reqPath).toBe("string");
        expect(row.refHost).toBe("example.com");
      }
    });

    it("rows are ordered by total descending", async () => {
      const r = await apiAttrib.reportAttributionReferrers({});
      const rows = r.Ok().rows;
      expect(rows[0].total).toBe(3); // app-b page1 highest
      expect(rows[0].reqPath).toBe("/vibe/alice/app-b");
    });
  });

  describe("filtered view (reqPath provided)", () => {
    it("returns only rows matching the reqPath prefix", async () => {
      const r = await apiAttrib.reportAttributionReferrers({ reqPath: "/vibe/alice/app-a" });
      expect(r.isOk()).toBe(true);
      const body = r.Ok();
      // 2 distinct groups for app-a:
      //   (example.com, /page1, /vibe/alice/app-a) → 2
      //   (example.com, /page2, /vibe/alice/app-a) → 1
      expect(body.rows).toHaveLength(2);
      for (const row of body.rows) {
        expect(row.reqPath).toBe("/vibe/alice/app-a");
      }
      expect(body.rows[0].total).toBe(2);
      expect(body.rows[0].refPath).toBe("/page1");
    });

    it("returns empty rows when no events match the filter", async () => {
      const r = await apiAttrib.reportAttributionReferrers({ reqPath: "/vibe/alice/no-such-app" });
      expect(r.isOk()).toBe(true);
      expect(r.Ok().rows).toHaveLength(0);
    });
  });
});
