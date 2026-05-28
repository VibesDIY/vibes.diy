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
      {
        logKey: "gvct-1",
        lineIdx: 0,
        ts: "2026-05-22T10:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
      {
        logKey: "gvct-1",
        lineIdx: 1,
        ts: "2026-06-01T00:00:00Z",
        refHref: "https://good.vibes.diy/campaign-page",
        refHost: "good.vibes.diy",
        refPath: "/campaign-page",
        reqMethod: "GET",
        reqPath: "/vibe/alice/my-app",
      },
    ]);
  }, 10000);

  it("excludes rows with ts after untilIso", async () => {
    const result = await fetchGoodVibesClickThroughs(appCtx.vibesCtx, "2026-05-21", "2026-05-28");
    expect(result["/campaign-page"]).toBe(1);
  });
});
