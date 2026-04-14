import * as React from "react";
import { createPortal } from "react-dom";

import { Button } from "../ui/button.js";
import type { ShareModalState } from "./useShareModal.js";

export function ShareModal({
  isOpen,
  close,
  buttonRef,
  canPublish,
  isPublishing,
  publishError,
  publishedUrl,
  handlePublish,
  autoJoinEnabled,
  isTogglingAutoJoin,
  handleToggleAutoJoin,
  urlCopied,
  handleCopyUrl,
}: ShareModalState) {
  React.useEffect(() => {
    if (isOpen !== true) {
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (isOpen !== true || buttonRef.current === null) {
    return null;
  }

  const buttonRect = buttonRef.current.getBoundingClientRect();
  const menuStyle = {
    position: "fixed" as const,
    top: `${buttonRect.bottom + 8}px`,
    right: `${window.innerWidth - buttonRect.right}px`,
  };

  const hasUrl = publishedUrl !== undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/25"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
      aria-label="Share modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] p-4"
      >
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Share</div>

          <div className="text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
            Private by default. Publishing creates a clean link; visitors can request access unless auto-join is enabled.
          </div>

          {publishError && <div className="text-xs text-red-600">{publishError}</div>}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="blue"
              size="fixed"
              className="w-full"
              onClick={() => void handlePublish()}
              disabled={isPublishing || canPublish !== true}
              title={canPublish ? undefined : "No fsId loaded"}
            >
              {isPublishing ? "Publishing…" : hasUrl ? "Update" : "Publish"}
            </Button>

            {hasUrl && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={publishedUrl}
                  className="flex-1 rounded border border-[var(--vibes-border-primary)] bg-[var(--vibes-gray-lighter)] px-2 py-1 text-xs font-mono truncate"
                  aria-label="Published URL"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="shrink-0 rounded border border-[var(--vibes-border-primary)] px-2 py-1 text-xs font-semibold hover:bg-[var(--vibes-gray-lighter)]"
                  title="Copy URL"
                >
                  {urlCopied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--vibes-border-primary)]" />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoJoinEnabled}
              onChange={() => void handleToggleAutoJoin()}
              disabled={isTogglingAutoJoin}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex flex-col">
              <span className="text-sm">Auto-join visitors</span>
              <span className="text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
                When off, visitors can request access.
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>,
    document.body
  );
}
