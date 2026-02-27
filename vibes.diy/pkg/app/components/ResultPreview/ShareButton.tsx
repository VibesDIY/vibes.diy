import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { URI } from "@adviser/cement";
import { PublishIcon } from "../HeaderContent/SvgIcons.js";

export interface SlugAvailability {
  available: boolean;
  message?: string; // e.g. "Not available", "Buy credits to use custom slugs"
}

interface ShareButtonProps {
  initialUserSlug: string;
  initialAppSlug: string;
  genUrl: (userSlug: string, appSlug: string) => Promise<string>;
  checkAvailability?: (userSlug: string, appSlug: string) => Promise<SlugAvailability>;
  onPublish?: (userSlug: string, appSlug: string) => Promise<void>;
}

export const ShareButton = forwardRef<HTMLButtonElement, ShareButtonProps>(
  ({ initialUserSlug, initialAppSlug, genUrl, checkAvailability, onPublish }, forwardedRef) => {
    const [isOpen, setIsOpen] = useState(false);
    const [userSlug, setUserSlug] = useState(initialUserSlug);
    const [appSlug, setAppSlug] = useState(initialAppSlug);
    const [url, setUrl] = useState("");
    const [urlCopied, setUrlCopied] = useState(false);
    const [availability, setAvailability] = useState<SlugAvailability | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isPublished, setIsPublished] = useState(false);
    const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });

    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Combine forwarded ref + internal ref
    const setButtonRef = useCallback(
      (el: HTMLButtonElement | null) => {
        (buttonRef as React.RefObject<HTMLButtonElement | null>).current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) (forwardedRef as React.RefObject<HTMLButtonElement | null>).current = el;
      },
      [forwardedRef]
    );

    // Position the portal popover below the button, right-aligned
    function openPopover() {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPopoverPos({
          top: rect.bottom + window.scrollY + 6,
          right: window.innerWidth - rect.right,
        });
      }
      setIsOpen(true);
    }

    // Close popover on outside click
    useEffect(() => {
      if (!isOpen) return;
      function handleClick(e: MouseEvent) {
        if (
          popoverRef.current &&
          !popoverRef.current.contains(e.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen]);

    // Recalculate URL whenever slugs change
    useEffect(() => {
      genUrl(userSlug, appSlug).then(setUrl);
    }, [userSlug, appSlug, genUrl]);

    // Debounced availability check
    const scheduleCheck = useCallback(
      (nextUser: string, nextApp: string) => {
        if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
        setAvailability(null);
        if (!checkAvailability || !nextUser || !nextApp) return;
        checkTimerRef.current = setTimeout(async () => {
          setIsChecking(true);
          try {
            setAvailability(await checkAvailability(nextUser, nextApp));
          } finally {
            setIsChecking(false);
          }
        }, 500);
      },
      [checkAvailability]
    );

    function handleUserSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      setUserSlug(v);
      scheduleCheck(v, appSlug);
    }

    function handleAppSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      setAppSlug(v);
      scheduleCheck(userSlug, v);
    }

    async function handleCopy() {
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }

    async function handlePublish() {
      if (!onPublish) return;
      setIsPublishing(true);
      try {
        await onPublish(userSlug, appSlug);
        setIsPublished(true);
      } finally {
        setIsPublishing(false);
      }
    }

    const slugsOk = availability?.available !== false;

    return (
      <>
        <button
          ref={setButtonRef}
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : openPopover())}
          className="bg-light-background-01 dark:bg-dark-decorative-01 text-light-secondary dark:text-dark-secondary hover:bg-light-background-02 dark:hover:bg-dark-decorative-00 focus:ring-light-border-01 dark:focus:ring-dark-border-01 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-semibold shadow focus:ring-1 focus:outline-none max-[767px]:aspect-square max-[767px]:p-2 min-[768px]:w-auto"
        >
          <PublishIcon className="h-5 w-5" />
          <span className="hidden text-xs whitespace-nowrap min-[1024px]:inline">Share</span>
        </button>

        {isOpen &&
          createPortal(
            <div
              ref={popoverRef}
              style={{ position: "absolute", top: popoverPos.top, right: popoverPos.right, zIndex: 9999 }}
              className="w-96 rounded-lg border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] p-4 flex flex-col gap-3"
            >
              {/* URL row */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Publish URL</span>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url ? URI.from(url).pathname : ""}
                    placeholder="URL will appear here"
                    className="flex-1 rounded border border-[var(--vibes-border-primary)] bg-[var(--vibes-gray-lighter)] px-2 py-1 text-xs font-mono truncate"
                  />
                  {isPublished && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!url}
                      title="Copy URL"
                      className="shrink-0 rounded border border-[var(--vibes-border-primary)] p-1.5 hover:bg-[var(--vibes-gray-lighter)] disabled:opacity-40"
                    >
                      {urlCopied ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 text-green-500"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Slug fields */}
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  User slug
                  <input
                    value={userSlug}
                    onChange={handleUserSlugChange}
                    placeholder="your-name"
                    className="rounded border border-[var(--vibes-border-primary)] bg-[var(--vibes-gray-lighter)] px-2 py-1 text-xs font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  App slug
                  <input
                    value={appSlug}
                    onChange={handleAppSlugChange}
                    placeholder="my-app"
                    className="rounded border border-[var(--vibes-border-primary)] bg-[var(--vibes-gray-lighter)] px-2 py-1 text-xs font-mono"
                  />
                </label>
              </div>

              {/* Availability feedback */}
              {isChecking && <p className="text-xs text-gray-400 animate-pulse">Checking availability…</p>}
              {!isChecking && availability && (
                <p className={`text-xs font-medium ${availability.available ? "text-green-500" : "text-red-500"}`}>
                  {availability.available ? "Available" : (availability.message ?? "Not available")}
                </p>
              )}

              {/* Publish button */}
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || !slugsOk || !onPublish}
                className="w-full rounded-md border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] px-4 py-2 text-sm font-bold shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPublishing ? "Publishing…" : "Publish"}
              </button>
            </div>,
            document.body
          )}
      </>
    );
  }
);
