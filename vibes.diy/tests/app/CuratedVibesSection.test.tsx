import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CuratedVibesGallery } from "~/vibes.diy/app/components/CuratedVibesSection.js";
import type { CuratedGroup } from "~/vibes.diy/app/hooks/useCuratedVibes.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

// These specs render the presentational gallery with fixed groups. The data
// hook (useCuratedVibes) is exercised separately in useCuratedVibes.test.tsx;
// keeping rendering synchronous here avoids the async getAppByFsId round-trip
// that flaked under the CI harness (isolate:false shared page — CharlieHelps
// review on #2540).
function renderGallery(groups: CuratedGroup[]) {
  return render(<CuratedVibesGallery groups={groups} loading={false} isMobile={false} />, { wrapper: vibesWrapper({}) });
}

describe("CuratedVibesGallery", () => {
  // Regression: signed-out cards must open the authless /vibe viewer, not the
  // auth-gated /chat editor (Codex review on #2540).
  it("links curated cards to the public /vibe viewer", () => {
    renderGallery([{ category: "Mind games", items: [{ ownerHandle: "jchris", appSlug: "melodle", title: "Melodle" }] }]);

    const link = screen.getByRole("link", { name: "Open Melodle" });
    expect(link.getAttribute("href")).toBe("/vibe/jchris/melodle");
  });

  // The showcase card overlaps the app icon on the card's top-left corner. The
  // corner icon is built from the app's icon cid ("sql://icon"); the cid
  // survives whatever URL-encoding the asset helper applies.
  it("renders the overlapping app icon on the card", () => {
    renderGallery([
      {
        category: "Mind games",
        items: [
          {
            ownerHandle: "jchris",
            appSlug: "melodle",
            title: "Melodle",
            icon: { cid: "sql://icon", mime: "image/png" },
            screenshot: { type: "screen-shot-ref", assetUrl: "sql://shot", mime: "image/png" },
          },
        ],
      },
    ]);

    const srcs = Array.from(document.querySelectorAll("img")).map((img) => img.getAttribute("src") ?? "");
    expect(srcs.some((s) => s.includes("icon"))).toBe(true);
  });

  // The enriched-prompt description is surfaced as a caption under the card.
  it("captions the card with the enriched-prompt description", () => {
    renderGallery([
      {
        category: "Mind games",
        items: [
          {
            ownerHandle: "jchris",
            appSlug: "melodle",
            title: "Melodle",
            description: "Guess the hidden melody one note at a time.",
          },
        ],
      },
    ]);

    expect(screen.getByText("Guess the hidden melody one note at a time.")).toBeTruthy();
  });
});
