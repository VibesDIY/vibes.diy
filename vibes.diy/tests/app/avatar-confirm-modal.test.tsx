import React from "react";
import { render as rtlRender, screen, act, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { AvatarConfirmModal } from "~/vibes.diy/app/components/AvatarConfirmModal.js";
import { avatarConfirmController } from "~/vibes.diy/app/lib/avatar-confirm.js";
import { PortalRootWrapper } from "./vibes-provider-harness.js";

// Render the modal's portal into a per-test container so it unmounts cleanly
// under isolate:false (see PortalRootWrapper).
const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: PortalRootWrapper, ...options });

// Security regression for #2418 review: the confirm modal must preview the
// host-supplied storage URI (getURL) for the CID it will persist — never a URL
// the sandbox could supply — so a vibe can't show one image while a different
// one is saved.

afterEach(() => {
  cleanup();
  // Drain any pending request so it doesn't leak into the next test.
  avatarConfirmController.current?.resolve(false);
});

describe("AvatarConfirmModal preview derivation", () => {
  it("derives the <img> src from the request getURL via /assets/cid", async () => {
    render(<AvatarConfirmModal />);

    let decision: Promise<boolean>;
    await act(async () => {
      decision = avatarConfirmController.request({
        cid: "bafyAVATAR123",
        mimeType: "image/png",
        getURL: "fp:store/bafyAVATAR123",
      });
    });

    // The img is rendered synchronously on open (before any network error can
    // swap in the placeholder), so its src reflects the derived URL. The URL is
    // built from getURL — the trusted storage URI — not the bare CID.
    const img = screen.getByAltText("Proposed avatar") as HTMLImageElement;
    expect(img.src).toContain("/assets/cid");
    expect(img.src).toContain(`url=${encodeURIComponent("fp:store/bafyAVATAR123")}`);
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

  it("shows no image when the host supplied no getURL for the CID", async () => {
    render(<AvatarConfirmModal />);

    let decision: Promise<boolean>;
    await act(async () => {
      decision = avatarConfirmController.request({ cid: "bafyUNKNOWN", mimeType: "image/png" });
    });

    // No trusted URI → no <img> (never a sandbox-guessable one), and the
    // consent gate still stands.
    expect(screen.queryByAltText("Proposed avatar")).not.toBeInTheDocument();
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();

    await act(async () => {
      avatarConfirmController.current?.resolve(false);
      await decision;
    });
  });
});
