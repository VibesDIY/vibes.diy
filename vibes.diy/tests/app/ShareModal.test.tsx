import * as React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShareModal } from "~/vibes.diy/app/components/ResultPreview/ShareModal.js";
import type { ShareModalState } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

function createState(overrides: Partial<ShareModalState> = {}): ShareModalState {
  const buttonEl = document.createElement("button");
  const buttonRef = { current: buttonEl } satisfies React.MutableRefObject<HTMLButtonElement | null>;

  const state: ShareModalState = {
    isOpen: true,
    open: () => {
      // no-op
    },
    close: () => {
      // no-op
    },
    buttonRef,
    isPublished: false,
    isPublishing: false,
    publishError: undefined,
    publishedUrl: undefined,
    canPublish: true,
    handlePublish: async () => {
      // no-op
    },
    autoJoinEnabled: false,
    isTogglingAutoJoin: false,
    handleToggleAutoJoin: async () => {
      // no-op
    },
    urlCopied: false,
    handleCopyUrl: async () => {
      // no-op
    },
  };

  return { ...state, ...overrides };
}

describe("ShareModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const state = createState({ isOpen: false });
    render(<ShareModal {...state} />);

    expect(screen.queryByLabelText("Share modal")).not.toBeInTheDocument();
  });

  it("calls close on backdrop click", () => {
    let closed = 0;
    const state = createState({
      close: () => {
        closed += 1;
      },
    });

    render(<ShareModal {...state} />);
    fireEvent.click(screen.getByLabelText("Share modal"));
    expect(closed).toBe(1);
  });

  it("calls close on Escape", () => {
    let closed = 0;
    const state = createState({
      close: () => {
        closed += 1;
      },
    });

    render(<ShareModal {...state} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(1);
  });

  it("calls handlePublish when clicking Publish", () => {
    let publishCalls = 0;
    const state = createState({
      publishedUrl: undefined,
      canPublish: true,
      handlePublish: async () => {
        publishCalls += 1;
      },
    });

    render(<ShareModal {...state} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(publishCalls).toBe(1);
  });

  it("renders URL and calls handleCopyUrl", () => {
    let copyCalls = 0;
    const state = createState({
      publishedUrl: "https://vibes.diy/vibe/jchris/ambient-weaver/",
      isPublished: true,
      handleCopyUrl: async () => {
        copyCalls += 1;
      },
    });

    render(<ShareModal {...state} />);
    expect(screen.getByLabelText("Published URL")).toHaveValue("https://vibes.diy/vibe/jchris/ambient-weaver/");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(copyCalls).toBe(1);
  });

  it("calls handleToggleAutoJoin", () => {
    let toggleCalls = 0;
    const state = createState({
      handleToggleAutoJoin: async () => {
        toggleCalls += 1;
      },
    });

    render(<ShareModal {...state} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggleCalls).toBe(1);
  });
});
