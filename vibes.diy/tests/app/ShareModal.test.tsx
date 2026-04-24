import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { UseShareModalReturn } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));

// PendingRequestsCard uses the VibesDiy provider which isn't set up in these
// unit tests; stub it out so the published view can render without a provider.
vi.mock("~/vibes.diy/app/components/mine/sharing-tab/PendingRequestsCard.js", () => ({
  PendingRequestsCard: () => <div data-testid="pending-requests-card" />,
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
    userSlug: "testuser",
    appSlug: "testapp",
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
    autoAcceptRole: undefined,
    isTogglingAutoJoin: false,
    handleToggleAutoJoin: vi.fn().mockResolvedValue(undefined),
    handleSetAutoAccept: vi.fn().mockResolvedValue(undefined),
    urlCopied: false,
    handleCopyUrl: vi.fn().mockResolvedValue(undefined),
    canPublish: true,
    isUpToDate: false,
    settingsLoaded: true,
    ...overrides,
  };
}

function getAutoApproveCheckbox() {
  return screen.getByRole("checkbox", { name: /Automatically approve new visitors/ });
}

describe("ShareModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockButtonEl = undefined;
  });

  describe("closed", () => {
    it("renders nothing when closed", () => {
      const modal = createMockModal({ isOpen: false });
      render(<ShareModal modal={modal} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("unpublished view", () => {
    it("renders the auto-approve checkbox and Publish button", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);
      expect(getAutoApproveCheckbox()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    });

    it("auto-approve defaults to enabled with role 'editors'", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);
      expect(getAutoApproveCheckbox()).toBeChecked();
      expect(screen.getByRole("combobox")).toHaveValue("editor");
    });

    it("publishes with autoJoin=true and the selected role", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledTimes(1);
      expect(modal.handlePublish).toHaveBeenCalledWith(true, "editor");
    });

    it("publishes with autoJoin=false when the checkbox is unchecked", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledTimes(1);
      expect(modal.handlePublish).toHaveBeenCalledWith(false, "editor");
    });

    it("publishes with the selected role when role is changed to readers", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "viewer" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(true, "viewer");
    });

    it("hides the role dropdown when auto-approve is off", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows 'Publishing...' while publish is in flight and disables the button", () => {
      const modal = createMockModal({ isPublishing: true });
      render(<ShareModal modal={modal} />);
      expect(screen.getByRole("button", { name: "Publishing..." })).toBeDisabled();
    });

    it("disables the Publish button and shows the hint when canPublish is false", () => {
      const modal = createMockModal({ canPublish: false });
      render(<ShareModal modal={modal} />);

      expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
      expect(screen.getByText(/Generate some code first/)).toBeInTheDocument();
    });

    it("disables the Publish button when settings are not yet loaded", () => {
      const modal = createMockModal({ settingsLoaded: false });
      render(<ShareModal modal={modal} />);
      expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    });

    it("shows the publish error", () => {
      const modal = createMockModal({ publishError: "Failed to publish" });
      render(<ShareModal modal={modal} />);
      expect(screen.getByText("Failed to publish")).toBeInTheDocument();
    });
  });

  describe("published view", () => {
    const publishedModal = (overrides: Partial<UseShareModalReturn> = {}) =>
      createMockModal({
        isPublished: true,
        publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
        ...overrides,
      });

    it("shows the published URL, Copy Link, and Update button", () => {
      render(<ShareModal modal={publishedModal()} />);

      expect(screen.getByDisplayValue("https://vibes.diy/vibe/testuser/testapp/")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("Update preserves autoJoinEnabled and the current role", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(true, "editor");
    });

    it("Update falls back to role=viewer when autoAcceptRole is undefined", async () => {
      const modal = publishedModal({ autoJoinEnabled: false, autoAcceptRole: undefined });
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(false, "viewer");
    });

    it("calls handleCopyUrl when clicking Copy Link", async () => {
      const modal = publishedModal();
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(screen.getByText("Copy Link"));
      });

      expect(modal.handleCopyUrl).toHaveBeenCalledTimes(1);
    });

    it("shows the copied checkmark when urlCopied is true", () => {
      const modal = publishedModal({ urlCopied: true });
      render(<ShareModal modal={modal} />);
      expect(screen.getByTitle("Copied")).toBeInTheDocument();
    });

    it("reflects autoJoinEnabled on the auto-approve checkbox", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: true, autoAcceptRole: "viewer" })} />);
      expect(getAutoApproveCheckbox()).toBeChecked();
    });

    it("hides the role dropdown when auto-approve is off", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: false })} />);
      expect(getAutoApproveCheckbox()).not.toBeChecked();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows the role dropdown reflecting the current autoAcceptRole", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: true, autoAcceptRole: "viewer" })} />);
      expect(screen.getByRole("combobox")).toHaveValue("viewer");
    });

    it("calls handleSetAutoAccept when toggling the checkbox off", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      expect(modal.handleSetAutoAccept).toHaveBeenCalledWith(false, "editor");
    });

    it("calls handleSetAutoAccept when changing the role dropdown", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} />);

      await act(async () => {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "viewer" } });
      });

      expect(modal.handleSetAutoAccept).toHaveBeenCalledWith(true, "viewer");
    });

    it("disables the checkbox while a toggle is in flight", () => {
      render(<ShareModal modal={publishedModal({ isTogglingAutoJoin: true })} />);
      expect(getAutoApproveCheckbox()).toBeDisabled();
    });

    it("shows 'Up to date' when the current fsId matches production", () => {
      render(<ShareModal modal={publishedModal({ isUpToDate: true })} />);
      expect(screen.getByRole("button", { name: "Up to date" })).toBeDisabled();
    });

    it("shows an enabled 'Update' when the current fsId differs from production", () => {
      render(<ShareModal modal={publishedModal({ isUpToDate: false })} />);
      expect(screen.getByRole("button", { name: "Update" })).not.toBeDisabled();
    });

    it("renders the PendingRequestsCard", () => {
      render(<ShareModal modal={publishedModal()} />);
      expect(screen.getByTestId("pending-requests-card")).toBeInTheDocument();
    });
  });

  describe("dialog behavior", () => {
    it("closes on Escape key via window listener", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it("closes on backdrop click", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      fireEvent.click(screen.getByRole("dialog"));

      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it("does not close when clicking inside the modal content", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} />);

      const content = screen.getByRole("dialog").firstElementChild as Element;
      expect(content).toBeTruthy();
      fireEvent.click(content);

      expect(modal.close).not.toHaveBeenCalled();
    });

    it("has proper dialog accessibility attributes", () => {
      render(<ShareModal modal={createMockModal()} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Share");
    });
  });
});
