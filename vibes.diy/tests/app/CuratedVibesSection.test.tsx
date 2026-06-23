import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CuratedVibesSection } from "~/vibes.diy/app/components/CuratedVibesSection.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockGetAppByFsId = vi.fn();
const mockVibeDiyApi = { getAppByFsId: mockGetAppByFsId };

interface OkAppArgs {
  ownerHandle: string;
  appSlug: string;
  grant: string;
  title?: string;
  icon?: { cid: string; mime: string };
  screenshot?: { assetUrl: string; mime: string };
  enrichedPrompt?: string;
}

function okApp({ ownerHandle, appSlug, grant, title, icon, screenshot, enrichedPrompt }: OkAppArgs) {
  const meta: unknown[] = [];
  if (title) meta.push({ type: "title", title });
  if (screenshot) meta.push({ type: "screen-shot-ref", assetUrl: screenshot.assetUrl, mime: screenshot.mime });
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({
      type: "vibes.diy.res-get-app-by-fsid",
      ownerHandle,
      appSlug,
      grant,
      error: undefined,
      meta,
      ...(icon ? { icon } : {}),
      ...(enrichedPrompt ? { enrichedPrompt } : {}),
    }),
    Err: () => ({ message: "unexpected error" }),
  };
}

describe("CuratedVibesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: signed-out cards must open the authless /vibe viewer, not the
  // auth-gated /chat editor (Codex review on #2540).
  it("links curated cards to the public /vibe viewer", async () => {
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle") return okApp({ ownerHandle, appSlug, grant: "public-access", title: "Melodle" });
      return okApp({ ownerHandle, appSlug, grant: "not-grant" });
    });

    render(<CuratedVibesSection isMobile={false} />, {
      wrapper: vibesWrapper({ chatApi: mockVibeDiyApi }),
    });

    const link = await waitFor(() => screen.getByRole("link", { name: "Open Melodle" }));
    expect(link.getAttribute("href")).toBe("/vibe/jchris/melodle");
  });

  // The showcase card overlaps the app icon on the card's top-left corner.
  // (The screenshot fill 404s in the test browser and swaps to the fallback,
  // so its DOM presence is racy; screenshot extraction is covered by the
  // useCuratedVibes hook test. The icon's error handler only hides the element,
  // so its src stays assertable here.)
  it("renders the overlapping app icon on the card", async () => {
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle")
        return okApp({
          ownerHandle,
          appSlug,
          grant: "public-access",
          title: "Melodle",
          icon: { cid: "sql://icon", mime: "image/png" },
          screenshot: { assetUrl: "sql://shot", mime: "image/png" },
        });
      return okApp({ ownerHandle, appSlug, grant: "not-grant" });
    });

    render(<CuratedVibesSection isMobile={false} />, {
      wrapper: vibesWrapper({ chatApi: mockVibeDiyApi }),
    });

    await waitFor(() => screen.getByRole("link", { name: "Open Melodle" }));
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    const srcs = imgs.map((img) => img.getAttribute("src") ?? "");
    // The overlapping corner icon is built from the app's icon cid ("sql://icon");
    // the cid survives whatever URL-encoding the asset helper applies.
    expect(srcs.some((s) => s.includes("icon"))).toBe(true);
  });

  // The enriched-prompt description is surfaced as a caption under the card.
  it("captions the card with the enriched-prompt description", async () => {
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle")
        return okApp({
          ownerHandle,
          appSlug,
          grant: "public-access",
          title: "Melodle",
          enrichedPrompt: "Guess the hidden melody one note at a time.",
        });
      return okApp({ ownerHandle, appSlug, grant: "not-grant" });
    });

    render(<CuratedVibesSection isMobile={false} />, {
      wrapper: vibesWrapper({ chatApi: mockVibeDiyApi }),
    });

    await waitFor(() => screen.getByText("Guess the hidden melody one note at a time."));
  });
});
