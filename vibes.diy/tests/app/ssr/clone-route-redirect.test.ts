// Regression test for the Clone 404 on the good.vibes.diy landing pages.
//
// The landing pages (e.g. good.vibes.diy/food-trucks) link the Clone button to
// `https://vibes.diy/clone/<owner>/<slug>`. The app never had a `/clone/...`
// route — cloning is the remix flow with `?skipChat=true` — so those links fell
// through to the `*` catch-all and rendered the 404 page. (Remix worked because
// `/remix/...` is a real route.)
//
// The `/clone/:ownerHandle/:appSlug/:fsId?` route exists purely to 302-redirect
// into the remix flow with skipChat forced on. This test pins that contract.

import { describe, it, expect } from "vitest";
import { loader as cloneLoader } from "../../../pkg/app/routes/clone.$ownerHandle.$appSlug.js";

function callLoader(params: { ownerHandle: string; appSlug: string; fsId?: string }) {
  return cloneLoader({ params });
}

describe("clone route redirect", () => {
  it("redirects /clone/og/<slug> to the remix flow with skipChat=true", async () => {
    const res = await callLoader({ ownerHandle: "og", appSlug: "daily-specials-board" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/remix/og/daily-specials-board?skipChat=true");
  });

  it("preserves the optional fsId segment", async () => {
    const res = await callLoader({ ownerHandle: "og", appSlug: "daily-specials-board", fsId: "zabc12345678" });
    expect(res.headers.get("Location")).toBe("/remix/og/daily-specials-board/zabc12345678?skipChat=true");
  });
});
