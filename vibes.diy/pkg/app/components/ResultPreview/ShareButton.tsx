import React, { forwardRef } from "react";
import { PublishIcon } from "../HeaderContent/SvgIcons.js";

interface ShareButtonProps {
  onClick: () => void;
  isPublishing: boolean;
  urlCopied: boolean;
  hasPublishedUrl?: boolean;
}

export const ShareButton = forwardRef<HTMLButtonElement, ShareButtonProps>(
  ({ onClick, isPublishing, urlCopied, hasPublishedUrl = false }, ref) => {
    // Button text/tooltip changes based on whether this is a first-time publish or reopening modal
    const buttonLabel = hasPublishedUrl ? "Share App" : "Publish";
    const buttonTooltip = hasPublishedUrl
      ? "View and share URL"
      : "Share with the world";

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={isPublishing}
        className="bg-light-background-01 dark:bg-dark-decorative-01 text-light-secondary dark:text-dark-secondary hover:bg-light-background-02 dark:hover:bg-dark-decorative-00 focus:ring-light-border-01 dark:focus:ring-dark-border-01 flex items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-semibold shadow focus:ring-1 focus:outline-none disabled:cursor-wait disabled:opacity-50 max-[767px]:aspect-square max-[767px]:p-2 min-[768px]:w-auto"
        aria-label={urlCopied ? "URL copied to clipboard" : buttonLabel}
        title={urlCopied ? "URL copied to clipboard" : buttonTooltip}
      >
        {isPublishing ? (
          <svg
            className="text-light-primary dark:text-dark-primary h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Publishing in progress"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : urlCopied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="URL copied to clipboard"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <PublishIcon className="h-5 w-5" />
        )}
        <span className="hidden text-xs whitespace-nowrap min-[1024px]:inline">
          {urlCopied ? "URL copied" : "Share"}
        </span>
      </button>
    );
  },
);
