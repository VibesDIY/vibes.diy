import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ChatMessageDocument, ViewControlsType } from "@vibes.diy/prompts";

vi.mock("react-router", async () => {
  const { vi } = await import("vitest");
  return {
    useParams: vi.fn().mockReturnValue({ sessionId: "url-session-id" }),
  };
});

vi.mock("~/vibes.diy/app/hooks/useSession.js", async () => {
  const { vi } = await import("vitest");
  return {
    useSession: vi.fn(),
  };
});

vi.mock(
  "~/vibes.diy/app/components/ResultPreview/useShareModal.js",
  async () => {
    const { vi } = await import("vitest");
    return {
      useShareModal: vi.fn(),
    };
  },
);

vi.mock("~/vibes.diy/app/components/ResultPreview/BackButton.js", () => ({
  BackButton: ({ onBackClick }: { onBackClick: () => void }) => (
    <button data-testid="back" onClick={onBackClick}>
      Back
    </button>
  ),
}));

vi.mock("~/vibes.diy/app/components/ResultPreview/SaveButton.js", () => ({
  SaveButton: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="save" onClick={onClick}>
      Save
    </button>
  ),
}));

vi.mock("~/vibes.diy/app/components/ResultPreview/ViewControls.js", () => ({
  ViewControls: () => <div data-testid="view-controls" />,
}));

vi.mock("~/vibes.diy/app/components/ResultPreview/ShareModal.js", () => ({
  ShareModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="share-modal" /> : null,
}));

import ResultPreviewHeaderContent from "~/vibes.diy/app/components/ResultPreview/ResultPreviewHeaderContent.js";
import { useSession } from "~/vibes.diy/app/hooks/useSession.js";
import { useShareModal } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

describe("ResultPreviewHeaderContent", () => {
  const mockMessages: ChatMessageDocument[] = [];

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    (useSession as Mock).mockReturnValue({
      session: { publishedUrl: undefined },
      docs: mockMessages,
      updatePublishedUrl: vi.fn().mockResolvedValue(undefined),
    });

    (useShareModal as Mock).mockReturnValue({
      isOpen: false,
      open: vi.fn(),
      close: vi.fn(),
      buttonRef: React.createRef(),
      canPublish: true,
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
    });
  });

  it("renders the Share button", () => {
    render(
      <ResultPreviewHeaderContent
        previewReady={true}
        displayView="preview"
        navigateToView={vi.fn()}
        viewControls={{} as unknown as ViewControlsType}
        showViewControls={true}
        isStreaming={false}
        code="const App = () => <div />"
        setMobilePreviewShown={vi.fn()}
        sessionId="prop-session-id"
      />,
    );

    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
  });

  it("calls shareModal.open when Share is clicked", () => {
    const open = vi.fn();
    (useShareModal as Mock).mockReturnValue({
      isOpen: false,
      open,
      close: vi.fn(),
      buttonRef: React.createRef(),
      canPublish: true,
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
    });

    render(
      <ResultPreviewHeaderContent
        previewReady={true}
        displayView="preview"
        navigateToView={vi.fn()}
        viewControls={{} as unknown as ViewControlsType}
        showViewControls={true}
        isStreaming={false}
        code="const App = () => <div />"
        setMobilePreviewShown={vi.fn()}
        sessionId="prop-session-id"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("handles back click when streaming", () => {
    const setMobilePreviewShown = vi.fn();
    const setUserClickedBack = vi.fn();

    render(
      <ResultPreviewHeaderContent
        previewReady={true}
        displayView="preview"
        navigateToView={vi.fn()}
        viewControls={{} as unknown as ViewControlsType}
        showViewControls={false}
        isStreaming={true}
        code="const App = () => <div />"
        setMobilePreviewShown={setMobilePreviewShown}
        setUserClickedBack={setUserClickedBack}
      />,
    );

    fireEvent.click(screen.getByTestId("back"));
    expect(setUserClickedBack).toHaveBeenCalledWith(true);
    expect(setMobilePreviewShown).toHaveBeenCalledWith(false);
  });

  it("renders SaveButton only in code view when there are changes", () => {
    const onCodeSave = vi.fn();

    render(
      <ResultPreviewHeaderContent
        previewReady={true}
        displayView="code"
        navigateToView={vi.fn()}
        viewControls={{} as unknown as ViewControlsType}
        showViewControls={false}
        isStreaming={false}
        code="const App = () => <div />"
        setMobilePreviewShown={vi.fn()}
        hasCodeChanges={true}
        onCodeSave={onCodeSave}
      />,
    );

    expect(screen.getByTestId("save")).toBeInTheDocument();
  });
});
