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

  it("shows auto-join toggle", () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);
    expect(screen.getByText("Auto-join")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("calls handleToggleAutoJoin when clicking toggle", async () => {
    const modal = createMockModal();
    render(<ShareModal modal={modal} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(modal.handleToggleAutoJoin).toHaveBeenCalledTimes(1);
  });

  it("shows auto-join enabled state", () => {
    const modal = createMockModal({ autoJoinEnabled: true });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Visitors join automatically")).toBeInTheDocument();
  });

  it("shows auto-join disabled state", () => {
    const modal = createMockModal({ autoJoinEnabled: false });
    render(<ShareModal modal={modal} />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Visitors can request access")).toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    const modal = createMockModal();
    const { container } = render(<ShareModal modal={modal} />);

    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.keyDown(backdrop as Element, { key: "Escape" });

    expect(modal.close).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const modal = createMockModal();
    const { container } = render(<ShareModal modal={modal} />);

    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);

    expect(modal.close).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside modal", () => {
    const modal = createMockModal();
    const { container } = render(<ShareModal modal={modal} />);

    const content = container.querySelector(".w-80");
    expect(content).toBeTruthy();
    fireEvent.click(content as Element);

    expect(modal.close).not.toHaveBeenCalled();
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
