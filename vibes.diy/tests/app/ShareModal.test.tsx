import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { UseShareModalReturn } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));

let mockButtonEl: HTMLButtonElement | undefined;

function createMockModal(overrides: Partial<UseShareModalReturn> = {}): UseShareModalReturn {
  mockButtonEl = document.createElement("button");
  mockButtonEl.getBoundingClientRect = vi.fn().mockReturnValue({
    bottom: 100,
    right: 200,
    width: 100,
    height: 40,
  });

  return {
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    buttonRef: { current: mockButtonEl },
    isPublished: false,
    isPublishing: false,
    publishError: undefined,
    publishedUrl: undefined,
    handlePublish: vi.fn().mockResolvedValue(undefined),
    autoJoinEnabled: false,
    isTogglingAutoJoin: false,
    handleToggleAutoJoin: vi.fn().mockResolvedValue(undefined),
    urlCopied: false,
    handleCopyUrl: vi.fn().mockResolvedValue(undefined),
    canPublish: true,
    isUpToDate: false,
    settingsLoaded: true,
    ...overrides,
  };
}

describe("ShareModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockButtonEl = undefined;
  });

  it("renders nothing when closed", () => {
    const modal = createMockModal({ isOpen: false });
    render(<ShareModal modal={modal} />);
    expect(screen.queryByRole("button", { name: "everyone" })).not.toBeInTheDocument();
  });

  it("renders Everyone and approved-members buttons when not yet published", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);
    expect(screen.getByRole("button", { name: "everyone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "approved members" })).toBeInTheDocument();
    expect(screen.getByText(/Publish your vibe to collaborate with/)).toBeInTheDocument();
  });

  it("publishes with autoJoin=true when clicking Everyone", async () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "everyone" }));
    });

    expect(modal.handlePublish).toHaveBeenCalledTimes(1);
    expect(modal.handlePublish).toHaveBeenCalledWith(true);
  });

  it("publishes with autoJoin=false when clicking Approved members", async () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "approved members" }));
    });

    expect(modal.handlePublish).toHaveBeenCalledTimes(1);
    expect(modal.handlePublish).toHaveBeenCalledWith(false);
  });

  it("shows publishing state while publish is in flight", () => {
    const modal = createMockModal({ isPublishing: true });
    render(<ShareModal modal={modal} />);
    expect(screen.getByText("Publishing...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "everyone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "approved members" })).toBeDisabled();
  });

  it("disables publish buttons when canPublish is false", () => {
    const modal = createMockModal({ canPublish: false });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("button", { name: "everyone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "approved members" })).toBeDisabled();
    expect(screen.getByText(/Generate some code first/)).toBeInTheDocument();
  });

  it("disables publish buttons when settings not yet loaded", () => {
    const modal = createMockModal({ settingsLoaded: false });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("button", { name: "everyone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "approved members" })).toBeDisabled();
  });

  it("shows publish error in unpublished view", () => {
    const modal = createMockModal({ publishError: "Failed to publish" });
    render(<ShareModal modal={modal} />);
    expect(screen.getByText("Failed to publish")).toBeInTheDocument();
  });

  it("shows published URL and Update button after publish", () => {
    const modal = createMockModal({
      isPublished: true,
      isUpToDate: false,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByDisplayValue("https://vibes.diy/vibe/testuser/testapp/")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
  });

  it("Update calls handlePublish with current autoJoinEnabled", async () => {
    const modal = createMockModal({
      isPublished: true,
      isUpToDate: false,
      autoJoinEnabled: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update" }));
    });

    expect(modal.handlePublish).toHaveBeenCalledWith(true);
  });

  it("calls handleCopyUrl when clicking copy button", async () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Copy Link"));
    });

    expect(modal.handleCopyUrl).toHaveBeenCalledTimes(1);
  });

  it("shows copied checkmark after copy", () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
      urlCopied: true,
    });
    render(<ShareModal modal={modal} />);
    expect(screen.getByTitle("Copied")).toBeInTheDocument();
  });

  it("shows 'Access open to everyone' when auto-join is enabled", () => {
    const modal = createMockModal({
      isPublished: true,
      autoJoinEnabled: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByText("Access open to everyone")).toBeInTheDocument();
  });

  it("shows 'Membership requires approval' when auto-join is disabled", () => {
    const modal = createMockModal({
      isPublished: true,
      autoJoinEnabled: false,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByText("Membership requires approval")).toBeInTheDocument();
  });

  it("renders the auto-join toggle and label in the published view", () => {
    const modal = createMockModal({
      isPublished: true,
      autoJoinEnabled: false,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByText("Auto-join")).toBeInTheDocument();
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-labelledby", "auto-join-label");
    expect(toggle).toHaveAttribute("aria-describedby", "auto-join-desc");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("reflects aria-checked=true when auto-join is enabled", () => {
    const modal = createMockModal({
      isPublished: true,
      autoJoinEnabled: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls handleToggleAutoJoin when clicking the toggle", async () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(modal.handleToggleAutoJoin).toHaveBeenCalledTimes(1);
  });

  it("disables the toggle while toggling is in flight", () => {
    const modal = createMockModal({
      isPublished: true,
      isTogglingAutoJoin: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("does not render the toggle in the unpublished view", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("does not render the Everyone/Approved buttons in the published view", () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.queryByRole("button", { name: "everyone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "approved members" })).not.toBeInTheDocument();
  });

  it("closes on Escape key via window listener", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(modal.close).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(modal.close).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside modal content", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    const dialog = screen.getByRole("dialog");
    const content = dialog.firstElementChild as Element;
    expect(content).toBeTruthy();
    fireEvent.click(content);

    expect(modal.close).not.toHaveBeenCalled();
  });

  it("has proper dialog accessibility attributes", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Share");
  });

  it("shows 'Up to date' when current fsId matches production", () => {
    const modal = createMockModal({
      isPublished: true,
      isUpToDate: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    const updateButton = screen.getByRole("button", { name: "Up to date" });
    expect(updateButton).toBeDisabled();
  });

  it("shows active 'Update' when current fsId differs from production", () => {
    const modal = createMockModal({
      isPublished: true,
      isUpToDate: false,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    const updateButton = screen.getByRole("button", { name: "Update" });
    expect(updateButton).not.toBeDisabled();
  });

  it("always shows copy button when published", () => {
    const modal = createMockModal({
      isPublished: true,
      isUpToDate: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByText("Copy Link")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://vibes.diy/vibe/testuser/testapp/")).toBeInTheDocument();
  });
});
