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

describe("report-campaign-health", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let apiCampaign: VibesDiyApi;
  let apiStar: VibesDiyApi;
  let apiNoAccess: VibesDiyApi;

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

    const userCampaign = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-campaign",
      publicMeta: { reports: ["campaign-health"] },
    });
    apiCampaign = makeApi(await userCampaign.getDashBoardToken());

    const userStar = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-star-campaign",
      publicMeta: { reports: ["*"] },
    });
    apiStar = makeApi(await userStar.getDashBoardToken());

    const userNoAccess = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-noaccess-campaign",
      publicMeta: { reports: ["growth"] },
    });
    apiNoAccess = makeApi(await userNoAccess.getDashBoardToken());
  }, TIMEOUT);

  describe("auth gate", () => {
    it("wrong report key → report-not-authorized", async () => {
      const r = await apiNoAccess.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { error?: { code?: string } }).error?.code).toBe("report-not-authorized");
    });

    it("['*'] permission + no Meta creds → meta-creds-missing", async () => {
      const r = await apiStar.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { error?: { code?: string } }).error?.code).toBe("meta-creds-missing");
    });
  });

  describe("missing Meta credentials", () => {
    it("campaign-health permission + no Meta creds → meta-creds-missing", async () => {
      const r = await apiCampaign.reportCampaignHealth({});
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { error?: { code?: string } }).error?.code).toBe("meta-creds-missing");
    });

    it("days param accepted alongside credential error", async () => {
      const r = await apiCampaign.reportCampaignHealth({ days: "30" });
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { error?: { code?: string } }).error?.code).toBe("meta-creds-missing");
    });

    it("since param accepted alongside credential error", async () => {
      const r = await apiCampaign.reportCampaignHealth({ since: "2026-01-01" });
      expect(r.isErr()).toBe(true);
      expect((r.Err() as { error?: { code?: string } }).error?.code).toBe("meta-creds-missing");
    });
  });
});
