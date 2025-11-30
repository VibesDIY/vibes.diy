import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { trackPublishClick, trackEvent } from "../../utils/analytics.js";
import PublishedVibeCard from "../PublishedVibeCard.js";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  publishedAppUrl?: string;
  onPublish: (shareToFirehose?: boolean) => Promise<void>;
  isPublishing: boolean;
  isFirehoseShared?: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  buttonRef,
  publishedAppUrl: iframeUrl,
  onPublish,
  isPublishing,
  isFirehoseShared = false,
}: ShareModalProps) {
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [shareToFirehose, setShareToFirehose] = useState(isFirehoseShared);

  const publishedSubdomain = iframeUrl
    ? new URL(iframeUrl).hostname.split(".")[0]
    : "";
  useEffect(() => {
    // Reset state when modal opens/closes
    if (isOpen) {
      trackEvent("share_modal_open");
      setShowUpdateSuccess(false);
      setShareToFirehose(isFirehoseShared);
    }
  }, [isOpen, isFirehoseShared]);

  const publishedAppUrl = publishedSubdomain
    ? `https://vibes.diy/vibe/${publishedSubdomain}`
    : "";

  if (!isOpen || !buttonRef.current) return null;

  // Get the button's position to position the menu relative to it
  const buttonRect = buttonRef.current.getBoundingClientRect();

  const menuStyle = {
    position: "fixed" as const,
    top: `${buttonRect.bottom + 8}px`, // 8px gap
    right: `${window.innerWidth - buttonRect.right}px`,
  };

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target === e.currentTarget) {
      trackEvent("share_modal_dismiss");
      onClose();
    }
  };

  const handlePublish = async () => {
    try {
      // Track the user's intent immediately (consent-gated in helper)
      trackPublishClick({ firehose_shared: shareToFirehose });
      await onPublish(shareToFirehose);
      if (publishedAppUrl) {
        setShowUpdateSuccess(true);
        setTimeout(() => setShowUpdateSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Error publishing app:", error);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          trackEvent("share_modal_dismiss");
          onClose();
        }
      }}
      aria-label="Share menu"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="ring-opacity-5 dark:bg-dark-background-01 w-80 rounded bg-white p-4 shadow-lg ring-1 ring-black"
      >
        <div
          className="py-1"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="share-menu"
        >
          <p className="mb-4 text-xs text-blue-700 italic dark:text-blue-200">
            You are in <strong>dev mode</strong>. Data is temporary until you
            publish your app. Publishing allows anyone with the link to share,
            remix, and install their own copy. Selected apps are featured in{" "}
            <a
              href="https://discord.gg/vnpWycj4Ta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              our community
            </a>
            .
          </p>
          {publishedAppUrl ? (
            <div className="bg-light-background-01 text-light-secondary dark:bg-dark-decorative-00 dark:text-dark-secondary rounded px-2 py-2 text-sm">
              <div className="text-center font-medium">
                <strong>
                  Published{" "}
                  <a
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    target="_blank"
                    href={publishedAppUrl}
                  >
                    {publishedSubdomain}
                  </a>
                </strong>
              </div>

              {/* Show vibe icon/screenshot preview */}
              <div className="mt-3 mb-3">
                <PublishedVibeCard
                  slug={publishedSubdomain}
                  name={publishedSubdomain}
                />
              </div>

              <div className="mt-2">
                <div className="mb-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={shareToFirehose}
                      onChange={(e) => {
                        trackEvent("share_firehose_toggle", {
                          enabled: e.target.checked,
                        });
                        setShareToFirehose(e.target.checked);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      Share to firehose
                    </span>
                  </label>
                  <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                    <a
                      href="https://bsky.app/profile/therawvibes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Feature on Vibes DIY social feeds
                    </a>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={`flex w-full items-center justify-between rounded border border-blue-500 bg-transparent px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 ${isPublishing ? "animate-gradient-x stripes-overlay animate-pulse" : ""}`}
                >
                  <div className="flex items-center">
                    {showUpdateSuccess ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="mr-1 h-4 w-4 text-green-500"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-green-500">Updated!</span>
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="mr-1 h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <title>Update App</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        <span>Update Code</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shareToFirehose}
                    onChange={(e) => {
                      trackEvent("share_firehose_toggle", {
                        enabled: e.target.checked,
                      });
                      setShareToFirehose(e.target.checked);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:ring-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Share to firehose
                  </span>
                </label>
                <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                  <a
                    href="https://bsky.app/profile/therawvibes.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Feature on Vibes DIY social feeds
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className={`flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-violet-500 hover:via-pink-500 hover:to-orange-500 hover:shadow-xl focus:ring-4 focus:ring-violet-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-base dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400 ${isPublishing ? "animate-gradient-x stripes-overlay animate-pulse" : ""}`}
                role="menuitem"
              >
                <span className="flex items-center gap-3">
                  <span role="img" aria-label="disk">
                    💽
                  </span>
                  Publish App
                  <span role="img" aria-label="disk">
                    💽
                  </span>
                </span>
                {/* animated background indicates progress */}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
