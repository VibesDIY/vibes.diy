import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { fetchGoodVibesClickThroughs } from "../svc/public/report-campaign-health.js";

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
    ]);
  }, 10000);

  it("counts distinct fbclid values — same fbclid counts once, different fbclids count separately", async () => {
    const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    // AAA + BBB = 2; AAA duplicate excluded; organic excluded; CCC after untilIso excluded
    expect(result["/campaign-page"]).toBe(2);
  });

  it("excludes organic visits (no fbclid)", async () => {
    const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    // If organic were counted it would be 3; should be 2
    expect(result["/campaign-page"]).toBe(2);
  });

  it("excludes rows with ts after untilIso", async () => {
    const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    // CCC is after untilIso; should not appear
    expect(result["/campaign-page"]).toBe(2);
  });
});
