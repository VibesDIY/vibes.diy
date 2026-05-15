import { beforeAll, describe, expect, it, inject } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { processRequest } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createTestUserWithPublicMeta } from "./create-test-user-with-public-meta.js";

// Reports are gated on claims.params.public_meta.reports (an array of
// report keys, or ["*"]). The asset-session-bridge test pattern (real
// device-id token through processRequest) covers the auth wire-up; here
// we vary the public_meta to exercise the gate and seed grant tables to
// verify the per-day cumulative math.

const TIMEOUT = (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000;

function reportUrl(svc: { hostnameBase: string; protocol: string; port?: string }, path: string): string {
  const port = svc.port && svc.port !== "80" && svc.port !== "443" ? `:${svc.port}` : "";
  return `${svc.protocol}://${svc.hostnameBase.replace(/^\./, "")}${port}${path}`;
}

function daysAgoUTC(n: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n));
  // Use mid-day so per-day bucketing is unambiguous regardless of test runner's wallclock.
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

function todayUTC(): string {
  return daysAgoUTC(0).slice(0, 10);
}

describe("report-growth", { timeout: TIMEOUT }, () => {
  const sthis = ensureSuperThis();
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let svc: { hostnameBase: string; protocol: string; port?: string };
  let tokenWithGrowth: string;
  let tokenWithStar: string;
  let tokenWithEmpty: string;
  let tokenWithWrongKey: string;
  let tokenWithStringMeta: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    ctx = await createVibeDiyTestCtx(sthis, deviceCA);
    svc = ctx.vibesCtx.params.vibes.svc;

    const userGrowth = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-growth",
      publicMeta: { reports: ["growth", "scale"] },
    });
    tokenWithGrowth = (await userGrowth.getDashBoardToken()).token;

    const userStar = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-star",
      publicMeta: { reports: ["*"] },
    });
    tokenWithStar = (await userStar.getDashBoardToken()).token;

    const userEmpty = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-empty",
      publicMeta: { reports: [] },
    });
    tokenWithEmpty = (await userEmpty.getDashBoardToken()).token;

    const userWrong = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-wrong",
      publicMeta: { reports: ["billing"] },
    });
    tokenWithWrongKey = (await userWrong.getDashBoardToken()).token;

    // Real shipped createTestUser hardcodes public_meta to a string; the
    // gate must reject this shape rather than crash trying to read .reports.
    const userString = await createTestUserWithPublicMeta({
      sthis,
      deviceCA,
      userId: "tester-string",
      publicMeta: `{ "role": "tester" }`,
    });
    tokenWithStringMeta = (await userString.getDashBoardToken()).token;

    // Seed two memberships dated today (will appear in newMembers), one
    // dated 5 days ago (cumulative-only), and one in the future (filtered).
    // Plus a duplicate (request + invite for same triple) to exercise the
    // dedupe path — should only count once with the earliest date.
    const t = ctx.vibesCtx.sql.tables;
    const todayMid = daysAgoUTC(0);
    const fiveDaysAgo = daysAgoUTC(5);
    const futureDate = daysAgoUTC(-2);

    // Member slug bindings — so tooltips show slugs, not bare userIds.
    await ctx.vibesCtx.sql.db.insert(t.userSlugBinding).values([
      { userId: "member-alice", userSlug: "alice", tenant: "t-alice", created: fiveDaysAgo },
      { userId: "member-bob", userSlug: "bob", tenant: "t-bob", created: fiveDaysAgo },
      { userId: "member-carol", userSlug: "carol", tenant: "t-carol", created: todayMid },
    ]);

    await ctx.vibesCtx.sql.db.insert(t.requestGrants).values([
      // alice approved request on day -5
      {
        userId: "owner-1",
        appSlug: "vibe-x",
        userSlug: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-alice",
        foreignInfo: {},
        tick: "0",
        updated: fiveDaysAgo,
        created: fiveDaysAgo,
      },
      // bob approved request today
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        userSlug: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-bob",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      // bob also has an invite to same vibe-y → dedupe must collapse
      // (same earliest date so newMembers list has bob once for today).
      // duplicate-as-request: pending state should not count
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        userSlug: "owner-slug-1",
        state: "pending",
        role: "viewer",
        foreignUserId: "member-pending",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      // future-dated approved — must be filtered out of total + days
      {
        userId: "owner-1",
        appSlug: "vibe-z",
        userSlug: "owner-slug-1",
        state: "approved",
        role: "viewer",
        foreignUserId: "member-future",
        foreignInfo: {},
        tick: "0",
        updated: futureDate,
        created: futureDate,
      },
    ]);

    await ctx.vibesCtx.sql.db.insert(t.inviteGrants).values([
      // bob accepted invite to same (owner-slug-1, vibe-y) → dedupe collapse
      {
        userId: "owner-1",
        appSlug: "vibe-y",
        userSlug: "owner-slug-1",
        state: "accepted",
        role: "viewer",
        emailKey: "bob@example.com",
        tokenOrGrantUserId: "member-bob",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      // carol accepted invite today, different vibe → counts
      {
        userId: "owner-1",
        appSlug: "vibe-w",
        userSlug: "owner-slug-1",
        state: "accepted",
        role: "viewer",
        emailKey: "carol@example.com",
        tokenOrGrantUserId: "member-carol",
        foreignInfo: {},
        tick: "0",
        updated: todayMid,
        created: todayMid,
      },
      // pending invite → must not count
      {
        userId: "owner-1",
        appSlug: "vibe-p",
        userSlug: "owner-slug-1",
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

    // AppSlugBindings — one today, one 5 days ago, one in the future.
    await ctx.vibesCtx.sql.db.insert(t.appSlugBinding).values([
      { appSlug: "vibe-old", userSlug: "owner-slug-1", ledger: "led-1", created: fiveDaysAgo },
      { appSlug: "vibe-new", userSlug: "owner-slug-1", ledger: "led-2", created: todayMid },
      { appSlug: "vibe-future", userSlug: "owner-slug-1", ledger: "led-3", created: daysAgoUTC(-2) },
    ]);
  }, TIMEOUT);

  describe("auth gate", () => {
    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])("%s — missing Bearer → 401", async (path) => {
      const res = await processRequest(ctx.appCtx, new Request(reportUrl(svc, path), { method: "GET" }));
      expect(res.status).toBe(401);
    });

    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])("%s — garbage Bearer → 401", async (path) => {
      const res = await processRequest(
        ctx.appCtx,
        new Request(reportUrl(svc, path), { method: "GET", headers: { Authorization: "Bearer garbage" } })
      );
      expect(res.status).toBe(401);
    });

    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])(
      "%s — valid token, empty reports → 403",
      async (path) => {
        const res = await processRequest(
          ctx.appCtx,
          new Request(reportUrl(svc, path), { method: "GET", headers: { Authorization: `Bearer ${tokenWithEmpty}` } })
        );
        expect(res.status).toBe(403);
      }
    );

    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])(
      "%s — valid token, wrong report key → 403",
      async (path) => {
        const res = await processRequest(
          ctx.appCtx,
          new Request(reportUrl(svc, path), { method: "GET", headers: { Authorization: `Bearer ${tokenWithWrongKey}` } })
        );
        expect(res.status).toBe(403);
      }
    );

    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])(
      "%s — public_meta as string (not object) → 403, no crash",
      async (path) => {
        const res = await processRequest(
          ctx.appCtx,
          new Request(reportUrl(svc, path), {
            method: "GET",
            headers: { Authorization: `Bearer ${tokenWithStringMeta}` },
          })
        );
        expect(res.status).toBe(403);
      }
    );

    it.each([["/reports/growth/memberships"], ["/reports/growth/vibes-with-data"]])(
      "%s — ['*'] grants access → 200",
      async (path) => {
        const res = await processRequest(
          ctx.appCtx,
          new Request(reportUrl(svc, path), { method: "GET", headers: { Authorization: `Bearer ${tokenWithStar}` } })
        );
        expect(res.status).toBe(200);
      }
    );

    it("POST /reports/growth/memberships → not 200 (only GET handled)", async () => {
      const res = await processRequest(
        ctx.appCtx,
        new Request(reportUrl(svc, "/reports/growth/memberships"), {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenWithGrowth}` },
        })
      );
      expect(res.status).not.toBe(200);
    });
  });

  describe("memberships", () => {
    it("counts approved requests + accepted invites, dedupes duplicates, filters by state", async () => {
      const res = await processRequest(
        ctx.appCtx,
        new Request(reportUrl(svc, "/reports/growth/memberships"), {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenWithGrowth}` },
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe("vibes.diy.res-report-growth-memberships");
      expect(body.days).toHaveLength(30);
      // alice (request, day -5) + bob (request+invite, today, dedupe-to-1) + carol (invite, today) = 3
      // pending + future-dated must be excluded
      expect(body.total).toBe(3);

      const lastDay = body.days[body.days.length - 1];
      expect(lastDay.day).toBe(todayUTC());
      expect(lastDay.memberships).toBe(3);
      expect(lastDay.newMembers).toEqual(["bob", "carol"]);

      const fiveDaysAgoStr = daysAgoUTC(5).slice(0, 10);
      const fiveBucket = body.days.find((d: { day: string }) => d.day === fiveDaysAgoStr);
      expect(fiveBucket?.newMembers).toEqual(["alice"]);
      expect(fiveBucket?.memberships).toBe(1);
    });
  });

  describe("vibes-with-data", () => {
    it("counts distinct AppSlugBinding rows cumulatively, filters future", async () => {
      const res = await processRequest(
        ctx.appCtx,
        new Request(reportUrl(svc, "/reports/growth/vibes-with-data"), {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenWithGrowth}` },
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe("vibes.diy.res-report-growth-vibes-with-data");
      expect(body.days).toHaveLength(30);
      // vibe-old (day -5) + vibe-new (today) = 2; vibe-future filtered out
      expect(body.total).toBe(2);

      const lastDay = body.days[body.days.length - 1];
      expect(lastDay.day).toBe(todayUTC());
      expect(lastDay.vibes).toBe(2);

      const fiveBucket = body.days.find((d: { day: string }) => d.day === daysAgoUTC(5).slice(0, 10));
      expect(fiveBucket?.vibes).toBe(1);

      // Day before first seed — count is 0.
      const tenBucket = body.days.find((d: { day: string }) => d.day === daysAgoUTC(10).slice(0, 10));
      expect(tenBucket?.vibes).toBe(0);
    });
  });
});
