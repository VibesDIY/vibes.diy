import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { UseShareModalReturn } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

// Mock react-dom's createPortal to render children directly
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
    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
  });

  it("renders publish button when not yet published", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByText(/Publish your app/)).toBeInTheDocument();
  });

  it("calls handlePublish when clicking publish button", async () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    });

    expect(modal.handlePublish).toHaveBeenCalledTimes(1);
  });

  it("shows publishing state", () => {
    const modal = createMockModal({ isPublishing: true });
    render(<ShareModal modal={modal} />);
    expect(screen.getByText("Publishing...")).toBeInTheDocument();
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
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("calls handleCopyUrl when clicking copy button", async () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByText("Copy"));
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

  it("shows publish error", () => {
    const modal = createMockModal({ publishError: "Failed to publish" });
    render(<ShareModal modal={modal} />);
    expect(screen.getByText("Failed to publish")).toBeInTheDocument();
  });

  it("disables publish when canPublish is false", () => {
    const modal = createMockModal({ canPublish: false });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByText(/Generate some code first/)).toBeInTheDocument();
  });

  it("shows auto-join toggle only when published", () => {
    const unpublished = createMockModal();
    render(<ShareModal modal={unpublished} />);
    expect(screen.queryByText("Open access")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    cleanup();

    const published = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={published} />);
    expect(screen.getByText("Open access")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("calls handleToggleAutoJoin when clicking toggle", async () => {
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

  it("shows auto-join enabled state", () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
      autoJoinEnabled: true,
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Anyone with the link gets access")).toBeInTheDocument();
  });

  it("shows auto-join disabled state", () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
      autoJoinEnabled: false,
    });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("New users must be approved")).toBeInTheDocument();
  });

  it("closes on Escape key via window listener", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    // Escape is handled via window.addEventListener, not onKeyDown on the backdrop
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

    // Click on the inner panel (first child of dialog)
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

  it("auto-join switch has accessible name via aria-labelledby", () => {
    const modal = createMockModal({
      isPublished: true,
      publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
    });
    render(<ShareModal modal={modal} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-labelledby", "auto-join-label");
  });

  it("disables publish when settings not yet loaded", () => {
    const modal = createMockModal({ settingsLoaded: false });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
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

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://vibes.diy/vibe/testuser/testapp/")).toBeInTheDocument();
  });
});
