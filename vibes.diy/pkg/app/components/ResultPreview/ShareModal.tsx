import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button.js";
import type { UseShareModalResult } from "./useShareModal.js";

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
}: UseShareModalResult) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  if (!isOpen || !buttonRef.current) return null;

  const rect = buttonRef.current.getBoundingClientRect();
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 8,
    right: window.innerWidth - rect.right,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
      aria-label="Share modal backdrop"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="ring-opacity-5 dark:bg-dark-background-01 w-80 rounded bg-white p-4 shadow-lg ring-1 ring-black"
        aria-label="Share modal"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Button
              variant="blue"
              size="fixed"
              onClick={() => void handlePublish()}
              disabled={!canPublish || isPublishing}
            >
              {isPublishing
                ? "Publishing..."
                : publishedUrl
                  ? "Published"
                  : "Publish"}
            </Button>

            {publishedUrl && (
              <div className="rounded border border-black bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate underline"
                  >
                    {publishedUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    className="rounded border border-black bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    {urlCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Private by default; visitors can request access.
                </div>
              </div>
            )}

            {publishError && (
              <div className="rounded border border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700">
                {publishError}
              </div>
            )}
          </div>

          <div className="border-t border-black/10" />

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoJoinEnabled}
                onChange={() => void handleToggleAutoJoin()}
                disabled={isTogglingAutoJoin}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Auto-join
            </label>
            <div className="text-xs text-gray-600">
              When off, visitors can request access.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
