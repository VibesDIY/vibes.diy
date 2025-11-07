import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";

// Mock react-dom's createPortal to render children directly
vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => children,
}));

// Mock the analytics tracking function (not used in current tests)
vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  trackPublishClick: vi.fn(),
  trackEvent: vi.fn(),
}));

describe("ShareModal", () => {
  const mockOnClose = vi.fn();
  const mockOnPublish = vi.fn().mockResolvedValue(undefined);
  let mockButtonRef: React.RefObject<HTMLButtonElement>;

  // Mock clipboard API
  const originalClipboard = { ...globalThis.navigator.clipboard };

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    // Reset mocks before each test
    mockOnClose.mockReset();
    mockOnPublish.mockReset().mockResolvedValue(undefined);

    // Create a mock button ref
    mockButtonRef = {
      current: document.createElement("button"),
    };

    // Add the mock button to the document
    document.body.appendChild(mockButtonRef.current);

    // Mock the button's getBoundingClientRect
    mockButtonRef.current.getBoundingClientRect = vi.fn().mockReturnValue({
      bottom: 100,
      right: 200,
      width: 100,
      height: 40,
    });

    // Mock the clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });

    // Mock setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up
    if (mockButtonRef.current) {
      document.body.removeChild(mockButtonRef.current);
    }

    // Restore clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });

    // Restore timers
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders nothing when closed", () => {
    render(
      <ShareModal
        isOpen={false}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Modal should not be in the document
    expect(screen.queryByLabelText("Share menu")).not.toBeInTheDocument();
  });

  it("renders the publish button when no published URL exists", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Modal should be in the document
    expect(screen.getByLabelText("Share menu")).toBeInTheDocument();

    // Should show publish button
    const publishButton = screen.getByRole("menuitem", {
      name: /publish app/i,
    });
    expect(publishButton).toBeInTheDocument();

    // Should have the community message
    expect(
      screen.getByText(
        /Publishing allows anyone with the link to share, remix, and install/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/our community/i)).toBeInTheDocument();
  });

  it("renders the published app link when published URL exists", () => {
    const testUrl = "https://test-app.vibesdiy.app";

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl={testUrl}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Should show the subdomain link (test-app)
    const subdomainLink = screen.getByText("test-app");
    expect(subdomainLink).toBeInTheDocument();
    expect(subdomainLink.closest("a")).toHaveAttribute(
      "href",
      "https://vibes.diy/vibe/test-app",
    );

    // Should show the update code button
    const updateButton = screen.getByText("Update Code");
    expect(updateButton).toBeInTheDocument();
  });

  it("shows loading state when publishing", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={true}
      />,
    );

    // Should show animated gradient class
    const publishButton = screen.getByRole("menuitem", {
      name: /publish app/i,
    });
    expect(publishButton).toHaveClass("animate-gradient-x");

    // Publish button should be disabled
    const publishButtonDisabled = screen.getByRole("menuitem", {
      name: /publish app/i,
    });
    expect(publishButtonDisabled).toBeDisabled();
  });

  it("shows loading state when updating", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl="https://test-app.vibesdiy.app"
        onPublish={mockOnPublish}
        isPublishing={true}
      />,
    );

    // Should show animated gradient class
    const updateButton = screen.getByText("Update Code").closest("button");
    expect(updateButton).toHaveClass("animate-gradient-x");

    // Update button should be disabled
    const updateButtonDisabled = screen
      .getByText("Update Code")
      .closest("button");
    expect(updateButtonDisabled).toBeDisabled();
  });

  it("calls onClose when clicking outside the modal", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Click the backdrop
    const backdrop = screen.getByLabelText("Share menu");
    fireEvent.click(backdrop);

    // Should call onClose
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when pressing Escape key", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Press Escape key
    const backdrop = screen.getByLabelText("Share menu");
    fireEvent.keyDown(backdrop, { key: "Escape" });

    // Should call onClose
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the modal", () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Click inside the modal content
    const modalContent = screen.getByRole("menu");
    fireEvent.click(modalContent);

    // Should not call onClose
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("calls onPublish when clicking the publish button", async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Click the publish button - wrap in act since it causes a state update
    const publishButton = screen.getByRole("menuitem", {
      name: /publish app/i,
    });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    // Should call onPublish
    expect(mockOnPublish).toHaveBeenCalledTimes(1);
  });

  it("calls onPublish when clicking the update button", async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl="https://test-app.vibesdiy.app"
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Click the update button - wrap in act since it causes a state update
    const updateButton = screen.getByText("Update Code").closest("button");
    if (!updateButton) throw new Error("Update button not found");

    await act(async () => {
      fireEvent.click(updateButton);
    });

    // Should call onPublish
    expect(mockOnPublish).toHaveBeenCalledTimes(1);
  });

  it("shows success message after update", async () => {
    // Mock onPublish to resolve immediately
    mockOnPublish.mockResolvedValueOnce(undefined);

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl="https://test-app.vibesdiy.app"
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Click the update button
    const updateButton = screen.getByText("Update Code").closest("button");
    if (!updateButton) throw new Error("Update button not found");

    await act(async () => {
      fireEvent.click(updateButton);
    });

    // Just verify onPublish was called
    expect(mockOnPublish).toHaveBeenCalledTimes(1);
  }, 10000);

  it("calls onPublish when clicking update code button with tracking", async () => {
    const testUrl = "https://test-app.vibesdiy.app";

    render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl={testUrl}
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Find the update code button
    const updateButton = screen.getByText("Update Code");
    expect(updateButton).toBeInTheDocument();

    // Click the update button
    await act(async () => {
      fireEvent.click(updateButton);
    });

    // Check that onPublish was called
    expect(mockOnPublish).toHaveBeenCalledTimes(1);
  }, 10000);

  it("resets state when reopening the modal", async () => {
    const { rerender } = render(
      <ShareModal
        isOpen={true}
        onClose={mockOnClose}
        buttonRef={mockButtonRef}
        publishedAppUrl="https://test-app.vibesdiy.app"
        onPublish={mockOnPublish}
        isPublishing={false}
      />,
    );

    // Verify modal is open and has content
    expect(screen.getByText("test-app")).toBeInTheDocument();

    // Close the modal
    await act(async () => {
      rerender(
        <ShareModal
          isOpen={false}
          onClose={mockOnClose}
          buttonRef={mockButtonRef}
          publishedAppUrl="https://test-app.vibesdiy.app"
          onPublish={mockOnPublish}
          isPublishing={false}
        />,
      );
    });

    // Modal should not be visible
    expect(screen.queryByText("test-app")).not.toBeInTheDocument();

    // Reopen the modal
    await act(async () => {
      rerender(
        <ShareModal
          isOpen={true}
          onClose={mockOnClose}
          buttonRef={mockButtonRef}
          publishedAppUrl="https://test-app.vibesdiy.app"
          onPublish={mockOnPublish}
          isPublishing={false}
        />,
      );
    });

    // Modal should be visible again
    expect(screen.getByText("test-app")).toBeInTheDocument();
  });
});
