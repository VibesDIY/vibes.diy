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

function daysAgoUTC(n: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

function todayUTC(): string {
  return daysAgoUTC(0).slice(0, 10);
}

describe("report-growth", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let apiGrowth: VibesDiyApi;
  let apiStar: VibesDiyApi;
  let apiEmpty: VibesDiyApi;
  let apiWrongKey: VibesDiyApi;
  let apiStringMeta: VibesDiyApi;

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

    const userGrowth = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-growth",
      publicMeta: { reports: ["growth", "scale"] },
    });
    apiGrowth = makeApi(await userGrowth.getDashBoardToken());

    const userStar = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-star",
      publicMeta: { reports: ["*"] },
    });
    apiStar = makeApi(await userStar.getDashBoardToken());

    const userEmpty = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-empty",
      publicMeta: { reports: [] },
    });
    apiEmpty = makeApi(await userEmpty.getDashBoardToken());

    const userWrong = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-wrong",
      publicMeta: { reports: ["billing"] },
    });
    apiWrongKey = makeApi(await userWrong.getDashBoardToken());

    // Shipped createTestUser hardcodes public_meta to a JSON-string sentinel
    // (not an object). Gate must reject this shape, not crash on undefined.reports.
    const userString = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-string",
      publicMeta: `{ "role": "tester" }`,
    });
    apiStringMeta = makeApi(await userString.getDashBoardToken());

    // Seed data: alice (request, day -5), bob (request+invite same vibe, today,
    // dedupe-to-1), carol (invite, today, different vibe). Plus pending-request
    // and pending-invite which must not count, and a future-dated approved
    // which must be filtered from total and per-day buckets.
    const t = appCtx.vibesCtx.sql.tables;
    const todayMid = daysAgoUTC(0);
    const fiveDaysAgo = daysAgoUTC(5);
    const futureDate = daysAgoUTC(-2);

    await appCtx.vibesCtx.sql.db.insert(t.handleBinding).values([
      { userId: "member-alice", handle: "alice", tenant: "t-alice", created: fiveDaysAgo },
      { userId: "member-bob", handle: "bob", tenant: "t-bob", created: fiveDaysAgo },
      { userId: "member-carol", handle: "carol", tenant: "t-carol", created: todayMid },
    ]);

    await appCtx.vibesCtx.sql.db.insert(t.requestGrants).values([
      {
        userId: "owner-1",
        appSlug: "vibe-x",
        ownerHandle: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-alice",
        foreignInfo: {},
        tick: "0",
        updated: fiveDaysAgo,
        created: fiveDaysAgo,
      },
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        ownerHandle: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-bob",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        ownerHandle: "owner-slug-1",
        state: "pending",
        role: "viewer",
        foreignUserId: "member-pending",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      {
        userId: "owner-1",
        appSlug: "vibe-z",
        ownerHandle: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-future",
        foreignInfo: {},
        tick: "0",
        updated: futureDate,
        created: futureDate,
      },
    ]);

    await appCtx.vibesCtx.sql.db.insert(t.inviteGrants).values([
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        ownerHandle: "owner-slug-1",
        state: "accepted",
        role: "viewer",
        emailKey: "bob@example.com",
        tokenOrGrantUserId: "member-bob",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      {
        userId: "owner-1",
        appSlug: "vibe-w",
        ownerHandle: "owner-slug-1",
        state: "accepted",
        role: "viewer",
        emailKey: "carol@example.com",
        tokenOrGrantUserId: "member-carol",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      {
        userId: "owner-1",
        appSlug: "vibe-p",
        ownerHandle: "owner-slug-1",
        state: "pending",
        role: "viewer",
        emailKey: "pending@example.com",
        tokenOrGrantUserId: "pending-token",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
    ]);

    await appCtx.vibesCtx.sql.db.insert(t.appSlugBinding).values([
      { appSlug: "vibe-old", ownerHandle: "owner-slug-1", ledger: "led-1", created: fiveDaysAgo },
      { appSlug: "vibe-new", ownerHandle: "owner-slug-1", ledger: "led-2", created: todayMid },
      { appSlug: "vibe-future", ownerHandle: "owner-slug-1", ledger: "led-3", created: daysAgoUTC(-2) },
    ]);
  }, TIMEOUT);

  describe("auth gate", () => {
    it.each<["memberships" | "vibesWithData"]>([["memberships"], ["vibesWithData"]])(
      "%s — empty reports array → not authorized",
      async (kind) => {
        const r =
          kind === "memberships" ? await apiEmpty.reportGrowthMemberships({}) : await apiEmpty.reportGrowthVibesWithData({});
        expect(r.isErr()).toBe(true);
        const err = r.Err() as { error?: { code?: string } };
        expect(err.error?.code).toBe("report-not-authorized");
      }
    );

    it.each<["memberships" | "vibesWithData"]>([["memberships"], ["vibesWithData"]])(
      "%s — wrong report key → not authorized",
      async (kind) => {
        const r =
          kind === "memberships" ? await apiWrongKey.reportGrowthMemberships({}) : await apiWrongKey.reportGrowthVibesWithData({});
        expect(r.isErr()).toBe(true);
        const err = r.Err() as { error?: { code?: string } };
        expect(err.error?.code).toBe("report-not-authorized");
      }
    );

    it.each<["memberships" | "vibesWithData"]>([["memberships"], ["vibesWithData"]])(
      "%s — public_meta string shape rejected, no crash",
      async (kind) => {
        const r =
          kind === "memberships"
            ? await apiStringMeta.reportGrowthMemberships({})
            : await apiStringMeta.reportGrowthVibesWithData({});
        expect(r.isErr()).toBe(true);
        const err = r.Err() as { error?: { code?: string } };
        expect(err.error?.code).toBe("report-not-authorized");
      }
    );

    it.each<["memberships" | "vibesWithData"]>([["memberships"], ["vibesWithData"]])(
      "%s — ['*'] grants access → ok",
      async (kind) => {
        const r = kind === "memberships" ? await apiStar.reportGrowthMemberships({}) : await apiStar.reportGrowthVibesWithData({});
        expect(r.isOk()).toBe(true);
      }
    );
  });

  describe("memberships", () => {
    it("counts approved requests + accepted invites, dedupes, filters state and future", async () => {
      const r = await apiGrowth.reportGrowthMemberships({});
      expect(r.isOk()).toBe(true);
      const body = r.Ok();
      expect(body.type).toBe("vibes.diy.res-report-growth-memberships");
      expect(body.days).toHaveLength(30);
      // alice + bob (dedupe) + carol = 3
      expect(body.total).toBe(3);

      const lastDay = body.days[body.days.length - 1];
      expect(lastDay.day).toBe(todayUTC());
      expect(lastDay.memberships).toBe(3);
      expect(lastDay.newMembers).toEqual(["bob", "carol"]);

      const fiveDaysAgoStr = daysAgoUTC(5).slice(0, 10);
      const fiveBucket = body.days.find((d) => d.day === fiveDaysAgoStr);
      expect(fiveBucket?.newMembers).toEqual(["alice"]);
      expect(fiveBucket?.memberships).toBe(1);
    });
  });

  describe("vibes-with-data", () => {
    it("counts distinct AppSlugBindings cumulatively, filters future", async () => {
      const r = await apiGrowth.reportGrowthVibesWithData({});
      expect(r.isOk()).toBe(true);
      const body = r.Ok();
      expect(body.type).toBe("vibes.diy.res-report-growth-vibes-with-data");
      expect(body.days).toHaveLength(30);
      // vibe-old + vibe-new = 2; vibe-future filtered
      expect(body.total).toBe(2);

      const lastDay = body.days[body.days.length - 1];
      expect(lastDay.day).toBe(todayUTC());
      expect(lastDay.vibes).toBe(2);

      const fiveBucket = body.days.find((d) => d.day === daysAgoUTC(5).slice(0, 10));
      expect(fiveBucket?.vibes).toBe(1);

      const tenBucket = body.days.find((d) => d.day === daysAgoUTC(10).slice(0, 10));
      expect(tenBucket?.vibes).toBe(0);
    });
  });
});
