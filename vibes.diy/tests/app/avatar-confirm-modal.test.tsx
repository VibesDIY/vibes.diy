import React from "react";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { AvatarConfirmModal } from "~/vibes.diy/app/components/AvatarConfirmModal.js";
import { avatarConfirmController } from "~/vibes.diy/app/lib/avatar-confirm.js";

// Security regression for #1968 review: the confirm modal must preview the
// asset addressed by the CID it will persist — never a URL the sandbox could
// supply — so a vibe can't show one image while a different one is saved.

afterEach(() => {
  cleanup();
  // Drain any pending request so it doesn't leak into the next test.
  avatarConfirmController.current?.resolve(false);
});

describe("AvatarConfirmModal preview derivation", () => {
  it("derives the <img> src from the request CID via /assets/cid", async () => {
    render(<AvatarConfirmModal />);

    let decision: Promise<boolean>;
    await act(async () => {
      decision = avatarConfirmController.request({ cid: "bafyAVATAR123", mimeType: "image/png" });
    });

    // The img is rendered synchronously on open (before any network error can
    // swap in the placeholder), so its src reflects the derived URL.
    const img = screen.getByAltText("Proposed avatar") as HTMLImageElement;
    expect(img.src).toContain("/assets/cid");
    expect(img.src).toContain("url=bafyAVATAR123");
    expect(img.src).toContain("mime=image%2Fpng");

    // Confirm resolves the controller; assert the modal closes so we don't leak.
    await act(async () => {
      avatarConfirmController.current?.resolve(true);
      await decision;
    });
    await waitFor(() => {
      expect(screen.queryByAltText("Proposed avatar")).not.toBeInTheDocument();
    });
  });
});
