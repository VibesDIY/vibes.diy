import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { fetchGoodVibesClickThroughs, fetchDirectAppLandings, extractDirectUtm } from "../svc/public/report-campaign-health.js";

describe("fetchGoodVibesClickThroughs", () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.refererEvents).values([
      // user AAA clicks CTA once — counted once
      {
        logKey: "gvct-1",
        lineIdx: 0,
        ts: "2026-05-22T10:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page?fbclid=AAA",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      // user AAA clicks CTA again — same fbclid, should NOT inflate count
      {
        logKey: "gvct-1",
        lineIdx: 1,
        ts: "2026-05-22T10:05:00Z",
        refHref: "https://good.vibes.diy/campaign-page?fbclid=AAA",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      // user BBB — different fbclid, counted separately
      {
        logKey: "gvct-1",
        lineIdx: 2,
        ts: "2026-05-23T09:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page?fbclid=BBB",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      // organic visit (no fbclid) — excluded from paid campaign metric
      {
        logKey: "gvct-1",
        lineIdx: 3,
        ts: "2026-05-23T11:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      // user CCC after untilIso — excluded by date bound
      {
        logKey: "gvct-1",
        lineIdx: 4,
        ts: "2026-06-01T00:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page?fbclid=CCC",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      // utm_campaign attribution: user DDD from campaign 111 on /shared-page
      {
        logKey: "gvct-2",
        lineIdx: 0,
        ts: "2026-05-24T10:00:00Z",
        refHref: "https://good.vibes.diy/shared-page?fbclid=DDD&utm_campaign=111",
        refHost: "good.vibes.diy",
        refPath: "/shared-page",
        reqMethod: "GET",
        reqPath: "/vibe/bob/their-app",
      },
      // utm_campaign attribution: user EEE from campaign 222 on the same /shared-page
      {
        logKey: "gvct-2",
        lineIdx: 1,
        ts: "2026-05-24T11:00:00Z",
        refHref: "https://good.vibes.diy/shared-page?fbclid=EEE&utm_campaign=222",
        refHost: "good.vibes.diy",
        refPath: "/shared-page",
        reqMethod: "GET",
        reqPath: "/vibe/bob/their-app",
      },
      // utm_campaign attribution: user FFF from campaign 111 again — same campaign, different user
      {
        logKey: "gvct-2",
        lineIdx: 2,
        ts: "2026-05-24T12:00:00Z",
        refHref: "https://good.vibes.diy/shared-page?fbclid=FFF&utm_campaign=111",
        refHost: "good.vibes.diy",
        refPath: "/shared-page",
        reqMethod: "GET",
        reqPath: "/vibe/bob/their-app",
      },
      // no utm_campaign on /shared-page — counts in byPath only
      {
        logKey: "gvct-2",
        lineIdx: 3,
        ts: "2026-05-24T13:00:00Z",
        refHref: "https://good.vibes.diy/shared-page?fbclid=GGG",
        refHost: "good.vibes.diy",
        refPath: "/shared-page",
        reqMethod: "GET",
        reqPath: "/vibe/bob/their-app",
      },
    ]);
  }, 10000);

  describe("byPath (path-level totals)", () => {
    it("counts distinct fbclid values — same fbclid counts once, different fbclids count separately", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // AAA + BBB = 2; AAA duplicate excluded; organic excluded; CCC after untilIso excluded
      expect(result.byPath["/campaign-page"]).toBe(2);
    });

    it("excludes organic visits (no fbclid)", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // If organic were counted it would be 3; should be 2
      expect(result.byPath["/campaign-page"]).toBe(2);
    });

    it("excludes rows with ts after untilIso", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // CCC is after untilIso; should not appear
      expect(result.byPath["/campaign-page"]).toBe(2);
    });

    it("counts all fbclids for a path regardless of utm_campaign", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // DDD (c:111) + EEE (c:222) + FFF (c:111) + GGG (no utm) = 4
      expect(result.byPath["/shared-page"]).toBe(4);
    });
  });

  describe("byCampaignId (per-campaign attribution via utm_campaign)", () => {
    it("groups distinct fbclids by utm_campaign", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // campaign 111: DDD + FFF = 2
      expect(result.byCampaignId["111"]).toBe(2);
      // campaign 222: EEE = 1
      expect(result.byCampaignId["222"]).toBe(1);
    });

    it("rows without utm_campaign do not appear in byCampaignId", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      // GGG had no utm_campaign — only /campaign-page rows had no utm, and they use path "campaign-page"
      // neither "campaign-page" nor any null key should be in byCampaignId
      expect(Object.keys(result.byCampaignId)).not.toContain("/shared-page");
      expect(Object.keys(result.byCampaignId)).not.toContain("/campaign-page");
    });

    it("campaigns with no clicks return empty byCampaignId for that id", async () => {
      const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
      expect(result.byCampaignId["999"]).toBeUndefined();
    });
  });
});

describe("extractDirectUtm", () => {
  it("returns utm_campaign for a vibes.diy /vibe/ destination", () => {
    expect(extractDirectUtm("https://vibes.diy/vibe/og/cool?utm_campaign=direct-app-cool&fbclid=X")).toBe("direct-app-cool");
  });
  it("returns undefined for good.vibes.diy (good.vibes path is handled separately and wins)", () => {
    expect(extractDirectUtm("https://good.vibes.diy/page?utm_campaign=111")).toBeUndefined();
  });
  it("returns undefined for non-/vibe/ paths on vibes.diy", () => {
    expect(extractDirectUtm("https://vibes.diy/about?utm_campaign=x")).toBeUndefined();
  });
  it("returns undefined when utm_campaign is absent or empty", () => {
    expect(extractDirectUtm("https://vibes.diy/vibe/og/app")).toBeUndefined();
    expect(extractDirectUtm("https://vibes.diy/vibe/og/app?utm_campaign=")).toBeUndefined();
  });
  it("returns undefined for a malformed or missing URL", () => {
    expect(extractDirectUtm("not a url")).toBeUndefined();
    expect(extractDirectUtm(undefined)).toBeUndefined();
  });
  it("yields the same key for two campaigns sharing a destination (basis for shared flagging)", () => {
    const a = extractDirectUtm("https://vibes.diy/vibe/og/x?utm_campaign=direct-app-x");
    const b = extractDirectUtm("https://vibes.diy/vibe/og/x?utm_campaign=direct-app-x&fbclid=Z");
    expect(a).toBe(b);
    expect(a).toBe("direct-app-x");
  });
});

describe("fetchDirectAppLandings", () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const t = appCtx.vibesCtx.sql.tables;
    const mk = (logKey: string, lineIdx: number, ts: string, fbclid: string, utmCampaign: string) => ({
      logKey,
      lineIdx,
      ts,
      landHref: `https://vibes.diy/vibe/og/app?fbclid=${fbclid}&utm_campaign=${utmCampaign}`,
      landHost: "vibes.diy",
      landPath: "/vibe/og/app",
      fbclid,
      utmCampaign,
      ua: "Mozilla/5.0",
    });
    await appCtx.vibesCtx.sql.db.insert(t.landingEvents).values([
      mk("ld-1", 0, "2026-05-22T10:00:00Z", "AAA", "direct-app-foo"),
      mk("ld-1", 1, "2026-05-22T10:05:00Z", "AAA", "direct-app-foo"), // dup fbclid — counts once
      mk("ld-1", 2, "2026-05-23T09:00:00Z", "BBB", "direct-app-foo"),
      mk("ld-1", 3, "2026-05-23T11:00:00Z", "CCC", ""), // empty utm — excluded
      mk("ld-1", 4, "2026-06-01T00:00:00Z", "DDD", "direct-app-foo"), // after untilIso — excluded
      mk("ld-2", 0, "2026-05-24T10:00:00Z", "EEE", "direct-remix-bar"),
    ]);
  }, 10000);

  it("dedupes unique fbclid per utm_campaign", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(result.byUtmCampaign["direct-app-foo"]).toBe(2); // AAA (once) + BBB
    expect(result.byUtmCampaign["direct-remix-bar"]).toBe(1);
  });

  it("excludes rows with empty utm_campaign", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(Object.keys(result.byUtmCampaign)).not.toContain("");
  });

  it("excludes rows after untilIso", async () => {
    const result = await fetchDirectAppLandings(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(result.byUtmCampaign["direct-app-foo"]).toBe(2); // DDD (June 1) excluded
  });
});
