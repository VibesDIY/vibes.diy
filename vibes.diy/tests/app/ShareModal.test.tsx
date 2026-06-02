import React from "react";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { UseShareModalReturn } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));

// Sharing-tab section components hit useSharingPanel under the hood and bring
// in @tanstack/react-table; stub them so these tests stay focused on modal
// wiring (we assert by testid that the owner trio renders).
vi.mock("~/vibes.diy/app/components/mine/sharing-tab/PublicSharingSection.js", () => ({
  PublicSharingSection: () => <div data-testid="public-sharing-section" />,
}));
vi.mock("~/vibes.diy/app/components/mine/sharing-tab/RequestsSection.js", () => ({
  RequestsSection: () => <div data-testid="requests-section" />,
}));
vi.mock("~/vibes.diy/app/components/mine/sharing-tab/EmailInvitationsSection.js", () => ({
  EmailInvitationsSection: () => <div data-testid="email-invitations-section" />,
}));

// Members + Comments sections call useVibesDiy / Clerk; stub them out — these
// tests are focused on the publish/sharing flow.
vi.mock("~/vibes.diy/app/components/ResultPreview/MembersSection.js", () => ({
  MembersSection: () => <div data-testid="members-section" />,
}));
vi.mock("~/vibes.diy/app/components/ResultPreview/CommentsSection.js", () => ({
  CommentsSection: () => <div data-testid="comments-section" />,
}));

const okSettings = (entry: Record<string, unknown> = {}) =>
  Promise.resolve({
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ settings: { entry: { dbAcls: undefined, ...entry } } }),
  });
const okList = <T,>(items: T[]) =>
  Promise.resolve({
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ items }),
  });
const okHasAccess = (state: "not-found" | "pending" | "approved" | "revoked") =>
  Promise.resolve({
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ state }),
  });

const requestAccessMock = vi.fn().mockResolvedValue({
  isOk: () => true,
  isErr: () => false,
  Ok: () => ({ state: "pending" }),
});
const hasAccessRequestMock = vi.fn().mockReturnValue(okHasAccess("not-found"));

// Stable api reference — useSharingPanel's refetch callback depends on
// vibeDiyApi identity; a fresh object per render causes an infinite re-render
// loop in tests that mount OwnerSharingPanel.
const vibeDiyApiStub = {
  ensureAppSettings: () => okSettings(),
  listInviteGrants: () => okList([]),
  listRequestGrants: () => okList([]),
  requestAccess: requestAccessMock,
  hasAccessRequest: hasAccessRequestMock,
};

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({ vibeDiyApi: vibeDiyApiStub }),
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
    ownerHandle: "testuser",
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
    hasUnpublishedChanges: false,
    settingsLoaded: true,
    ...overrides,
  };
}

function getAutoApproveCheckbox() {
  return screen.getByRole("checkbox", { name: /Automatically approve new visitors/ });
}

describe("ShareModal", () => {
  beforeEach(() => {
    requestAccessMock.mockReset();
    requestAccessMock.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      Ok: () => ({ state: "pending" }),
    });
    hasAccessRequestMock.mockReset();
    hasAccessRequestMock.mockReturnValue(okHasAccess("not-found"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockButtonEl = undefined;
  });

  describe("closed", () => {
    it("renders nothing when closed", () => {
      const modal = createMockModal({ isOpen: false });
      render(<ShareModal modal={modal} isOwner />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("unpublished view", () => {
    it("renders the auto-approve checkbox and Publish button", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);
      expect(getAutoApproveCheckbox()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    });

    it("auto-approve defaults to enabled with role 'editors'", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);
      expect(getAutoApproveCheckbox()).toBeChecked();
      expect(screen.getByRole("combobox")).toHaveValue("editor");
    });

    it("publishes with autoJoin=true and the selected role", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledTimes(1);
      expect(modal.handlePublish).toHaveBeenCalledWith(true, "editor");
    });

    it("publishes with autoJoin=false when the checkbox is unchecked", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledTimes(1);
      expect(modal.handlePublish).toHaveBeenCalledWith(false, "editor");
    });

    it("publishes with the selected role when role is changed to editors", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "editor" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(true, "editor");
    });

    it("hides the role dropdown when auto-approve is off", async () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows 'Publishing...' while publish is in flight and disables the button", () => {
      const modal = createMockModal({ isPublishing: true });
      render(<ShareModal modal={modal} isOwner />);
      expect(screen.getByRole("button", { name: "Publishing..." })).toBeDisabled();
    });

    it("disables the Publish button and shows the hint when canPublish is false", () => {
      const modal = createMockModal({ canPublish: false });
      render(<ShareModal modal={modal} isOwner />);

      expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
      expect(screen.getByText(/Generate some code first/)).toBeInTheDocument();
    });

    it("disables the Publish button when settings are not yet loaded", () => {
      const modal = createMockModal({ settingsLoaded: false });
      render(<ShareModal modal={modal} isOwner />);
      expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    });

    it("shows the publish error", () => {
      const modal = createMockModal({ publishError: "Failed to publish" });
      render(<ShareModal modal={modal} isOwner />);
      expect(screen.getByText("Failed to publish")).toBeInTheDocument();
    });
  });

  describe("published owner view", () => {
    const publishedModal = (overrides: Partial<UseShareModalReturn> = {}) =>
      createMockModal({
        isPublished: true,
        publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
        ...overrides,
      });

    it("shows the published URL, Copy Link, and Update button", () => {
      render(<ShareModal modal={publishedModal()} isOwner />);

      expect(screen.getByDisplayValue("https://vibes.diy/vibe/testuser/testapp/")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("Update preserves autoJoinEnabled and the current role", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(true, "editor");
    });

    it("Update falls back to role=editor when autoAcceptRole is undefined", async () => {
      const modal = publishedModal({ autoJoinEnabled: false, autoAcceptRole: undefined });
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Update" }));
      });

      expect(modal.handlePublish).toHaveBeenCalledWith(false, "editor");
    });

    it("calls handleCopyUrl when clicking Copy Link", async () => {
      const modal = publishedModal();
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(screen.getByText("Copy Link"));
      });

      expect(modal.handleCopyUrl).toHaveBeenCalledTimes(1);
    });

    it("reflects autoJoinEnabled on the auto-approve checkbox", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: true, autoAcceptRole: "viewer" })} isOwner />);
      expect(getAutoApproveCheckbox()).toBeChecked();
    });

    it("hides the role dropdown when auto-approve is off", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: false })} isOwner />);
      expect(getAutoApproveCheckbox()).not.toBeChecked();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("shows the role dropdown reflecting the current autoAcceptRole", () => {
      render(<ShareModal modal={publishedModal({ autoJoinEnabled: true, autoAcceptRole: "viewer" })} isOwner />);
      expect(screen.getByRole("combobox")).toHaveValue("viewer");
    });

    it("calls handleSetAutoAccept when toggling the checkbox off", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.click(getAutoApproveCheckbox());
      });

      expect(modal.handleSetAutoAccept).toHaveBeenCalledWith(false, "editor");
    });

    it("calls handleSetAutoAccept when changing the role dropdown", async () => {
      const modal = publishedModal({ autoJoinEnabled: true, autoAcceptRole: "editor" });
      render(<ShareModal modal={modal} isOwner />);

      await act(async () => {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "viewer" } });
      });

      expect(modal.handleSetAutoAccept).toHaveBeenCalledWith(true, "viewer");
    });

    it("disables the checkbox while a toggle is in flight", () => {
      render(<ShareModal modal={publishedModal({ isTogglingAutoJoin: true })} isOwner />);
      expect(getAutoApproveCheckbox()).toBeDisabled();
    });

    it("shows 'Up to date' when the current fsId matches production", () => {
      render(<ShareModal modal={publishedModal({ isUpToDate: true })} isOwner />);
      expect(screen.getByRole("button", { name: "Up to date" })).toBeDisabled();
    });

    it("shows an enabled 'Update' when the current fsId differs from production", () => {
      render(<ShareModal modal={publishedModal({ isUpToDate: false })} isOwner />);
      expect(screen.getByRole("button", { name: "Update" })).not.toBeDisabled();
    });

    it("renders the unified sharing trio (public toggle + requests + email invites)", async () => {
      render(<ShareModal modal={publishedModal()} isOwner />);
      await waitFor(() => {
        expect(screen.getByTestId("public-sharing-section")).toBeInTheDocument();
      });
      expect(screen.getByTestId("requests-section")).toBeInTheDocument();
      expect(screen.getByTestId("email-invitations-section")).toBeInTheDocument();
    });
  });

  describe("published non-owner view", () => {
    const publishedModal = (overrides: Partial<UseShareModalReturn> = {}) =>
      createMockModal({
        isPublished: true,
        publishedUrl: "https://vibes.diy/vibe/testuser/testapp/",
        ...overrides,
      });

    it("shows Copy Link and a Request Access button (no publish controls)", async () => {
      render(<ShareModal modal={publishedModal()} myGrant="none" />);

      expect(screen.getByText("Copy Link")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Request Access" })).not.toBeDisabled();
      });
      expect(screen.queryByRole("button", { name: /Update|Publish/ })).not.toBeInTheDocument();
      expect(screen.queryByTestId("public-sharing-section")).not.toBeInTheDocument();
    });

    it("submits a request and switches to 'Request pending' on success", async () => {
      render(<ShareModal modal={publishedModal()} myGrant="none" />);

      const button = await screen.findByRole("button", { name: "Request Access" });
      await waitFor(() => expect(button).not.toBeDisabled());

      await act(async () => {
        fireEvent.click(button);
      });

      expect(requestAccessMock).toHaveBeenCalledTimes(1);
      expect(requestAccessMock).toHaveBeenCalledWith({ appSlug: "testapp", ownerHandle: "testuser" });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Request pending" })).toBeDisabled();
      });
    });

    it("starts in 'Request pending' when hasAccessRequest already returns pending", async () => {
      hasAccessRequestMock.mockReturnValueOnce(okHasAccess("pending"));
      render(<ShareModal modal={publishedModal()} myGrant="none" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Request pending" })).toBeDisabled();
      });
      expect(requestAccessMock).not.toHaveBeenCalled();
    });

    it("hides Request Access for editors", () => {
      render(<ShareModal modal={publishedModal()} myGrant="editor" />);
      expect(screen.queryByRole("button", { name: /Request Access|Request pending/ })).not.toBeInTheDocument();
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });
  });

  describe("dialog behavior", () => {
    it("closes on Escape key via window listener", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it("closes on backdrop click", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      fireEvent.click(screen.getByRole("dialog"));

      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it("does not close when clicking inside the modal content", () => {
      const modal = createMockModal();
      render(<ShareModal modal={modal} isOwner />);

      const content = screen.getByRole("dialog").firstElementChild as Element;
      expect(content).toBeTruthy();
      fireEvent.click(content);

      expect(modal.close).not.toHaveBeenCalled();
    });

    it("has proper dialog accessibility attributes", () => {
      render(<ShareModal modal={createMockModal()} isOwner />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Share");
    });
  });
});
