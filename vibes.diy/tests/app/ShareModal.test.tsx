import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { UseShareModalResult } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

function buildProps(
  overrides: Partial<UseShareModalResult> = {},
): UseShareModalResult {
  const button = document.createElement("button");
  button.getBoundingClientRect = vi.fn().mockReturnValue({
    bottom: 100,
    right: 200,
    width: 100,
    height: 40,
  });
  document.body.appendChild(button);

  const base: UseShareModalResult = {
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    buttonRef: { current: button },
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
  };

  return { ...base, ...overrides };
}

describe("ShareModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const props = buildProps({ isOpen: false });
    render(<ShareModal {...props} />);
    expect(screen.queryByLabelText("Share modal")).not.toBeInTheDocument();
  });

  it("calls handlePublish when clicking Publish", async () => {
    const handlePublish = vi.fn().mockResolvedValue(undefined);
    const props = buildProps({ handlePublish });
    render(<ShareModal {...props} />);

    const publishButton = screen.getByRole("button", { name: "Publish" });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    expect(handlePublish).toHaveBeenCalledTimes(1);
  });

  it("shows published URL and calls handleCopyUrl", async () => {
    const handleCopyUrl = vi.fn().mockResolvedValue(undefined);
    const props = buildProps({
      publishedUrl: "https://vibes.diy/vibe/test-app/",
      handleCopyUrl,
    });
    render(<ShareModal {...props} />);

    expect(
      screen.getByRole("link", { name: "https://vibes.diy/vibe/test-app/" }),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(handleCopyUrl).toHaveBeenCalledTimes(1);
  });

  it("calls handleToggleAutoJoin when clicking Auto-join checkbox", async () => {
    const handleToggleAutoJoin = vi.fn().mockResolvedValue(undefined);
    const props = buildProps({ handleToggleAutoJoin });
    render(<ShareModal {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Auto-join" }));
    });
    expect(handleToggleAutoJoin).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const close = vi.fn();
    const props = buildProps({ close });
    render(<ShareModal {...props} />);

    fireEvent.click(screen.getByLabelText("Share modal backdrop"));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const close = vi.fn();
    const props = buildProps({ close });
    render(<ShareModal {...props} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
