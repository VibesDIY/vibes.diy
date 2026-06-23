import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CuratedVibesSection } from "~/vibes.diy/app/components/CuratedVibesSection.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockGetAppByFsId = vi.fn();
const mockVibeDiyApi = { getAppByFsId: mockGetAppByFsId };

function okApp({ ownerHandle, appSlug, grant, title }: { ownerHandle: string; appSlug: string; grant: string; title?: string }) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({
      type: "vibes.diy.res-get-app-by-fsid",
      ownerHandle,
      appSlug,
      grant,
      error: undefined,
      meta: title ? [{ type: "title", title }] : [],
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
});
