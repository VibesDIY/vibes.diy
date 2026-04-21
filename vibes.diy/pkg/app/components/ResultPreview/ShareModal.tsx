import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button.js";
import type { UseShareModalReturn } from "./useShareModal.js";

interface ShareModalProps {
  modal: UseShareModalReturn;
}

const inlinePublishButton =
  "inline-flex items-center px-2 py-0.5 mx-0.5 rounded-[5px] border-2 border-black bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-[2px_2px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none";

export function ShareModal({ modal }: ShareModalProps) {
  useEffect(() => {
    if (!modal.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") modal.close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.isOpen, modal]);

  if (!modal.isOpen || !modal.buttonRef.current) return null;

  const buttonRect = modal.buttonRef.current.getBoundingClientRect();
  const menuStyle = {
    position: "fixed" as const,
    top: `${buttonRect.bottom + 8}px`,
    right: `${window.innerWidth - buttonRect.right}px`,
  };

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      modal.close();
    }
  }

  const publishDisabled = modal.isPublishing || !modal.canPublish || !modal.settingsLoaded;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Share"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-[5px] border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black] dark:bg-gray-900"
      >
        {modal.isPublished && modal.publishedUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={modal.publishedUrl}
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
              <Button variant="blue" size="default" onClick={() => void modal.handleCopyUrl()}>
                {modal.urlCopied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <title>Copied</title>
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-xs">Copy Link</span>
                )}
              </Button>
            </div>
            {modal.publishError ? <p className="text-xs text-red-600 dark:text-red-400">{modal.publishError}</p> : null}
            <Button
              variant={modal.isUpToDate ? "cool" : "blue"}
              size="fixed"
              className="w-full"
              onClick={() => void modal.handlePublish(modal.autoJoinEnabled)}
              disabled={modal.isPublishing || !modal.canPublish || modal.isUpToDate || !modal.settingsLoaded}
            >
              {modal.isPublishing ? "Updating..." : modal.isUpToDate ? "Up to date" : "Update"}
            </Button>
            <p id="auto-join-desc" className="text-center text-xs text-gray-500 dark:text-gray-400">
              {modal.autoJoinEnabled ? "Access open to everyone" : "Membership requires approval"}
            </p>
            <div className="flex items-center justify-between gap-3">
              <span id="auto-join-label" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Auto-join
              </span>
              <button
                type="button"
                role="switch"
                aria-labelledby="auto-join-label"
                aria-describedby="auto-join-desc"
                aria-checked={modal.autoJoinEnabled}
                disabled={modal.isTogglingAutoJoin}
                onClick={() => void modal.handleToggleAutoJoin()}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-black transition-colors ${
                  modal.autoJoinEnabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                } ${modal.isTogglingAutoJoin ? "opacity-50" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full border border-black bg-white shadow transition-transform ${
                    modal.autoJoinEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              Publish your vibe to collaborate with{" "}
              <button
                type="button"
                onClick={() => void modal.handlePublish(true)}
                disabled={publishDisabled}
                className={inlinePublishButton}
              >
                everyone
              </button>{" "}
              or{" "}
              <button
                type="button"
                onClick={() => void modal.handlePublish(false)}
                disabled={publishDisabled}
                className={inlinePublishButton}
              >
                approved members
              </button>
              .
            </p>
            {modal.isPublishing ? <p className="text-xs text-gray-500 dark:text-gray-400">Publishing...</p> : null}
            {modal.publishError ? <p className="text-xs text-red-600 dark:text-red-400">{modal.publishError}</p> : null}
            {!modal.canPublish ? (
              <p className="text-xs text-gray-500 dark:text-gray-500">Generate some code first to publish.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
