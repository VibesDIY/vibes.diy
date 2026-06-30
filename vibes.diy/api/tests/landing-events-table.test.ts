import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@vibes.diy/identity/testing";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("LandingEvents table", () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
  }, 10000);

  it("inserts and selects a LandingEvents row", async () => {
    const t = appCtx.vibesCtx.sql.tables;
    await appCtx.vibesCtx.sql.db.insert(t.landingEvents).values([
      {
        logKey: "le-1",
        lineIdx: 0,
        ts: "2026-05-22T10:00:00Z",
        landHref: "https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo",
        landHost: "vibes.diy",
        landPath: "/vibe/og/foo",
        fbclid: "AAA",
        utmCampaign: "direct-app-foo",
        ua: "Mozilla/5.0 (iPhone)",
      },
    ]);
    const rows = await appCtx.vibesCtx.sql.db.select().from(t.landingEvents);
    expect(rows.length).toBe(1);
    expect(rows[0].utmCampaign).toBe("direct-app-foo");
  });
});
