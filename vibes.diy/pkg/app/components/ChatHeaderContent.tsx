import React, { memo } from "react";
import { PILL_CLEARANCE } from "./PillPortal.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";

interface ChatHeaderContentProps {
  title: string;
  promptProcessing: boolean;
  codeReady: boolean;
  remixOf?: string;
  icon?: { cid: string; mime: string };
}

function ChatHeaderContent({ title, promptProcessing, codeReady, remixOf, icon }: ChatHeaderContentProps) {
  return (
    <div className="flex h-full w-full items-center gap-2 px-2 py-2" style={{ paddingLeft: PILL_CLEARANCE + 40 }}>
      {icon && (
        <img
          src={cidAssetUrl(icon.cid, icon.mime, getAppHostBaseUrl())}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="chrome-url-bar flex-1" title={title}>
        <span className="chrome-url-bar-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="8" cy="8" r="6" />
            <line x1="8" y1="5" x2="8" y2="8.5" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="app-name-display">
          {remixOf ? (
            <>
              <a
                href={`/vibe/${remixOf}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-02-light dark:text-accent-02-dark hover:underline"
                title={`Remix of ${remixOf}`}
                onClick={(e) => e.stopPropagation()}
              >
                🔀
              </a>{" "}
              {title}
            </>
          ) : (
            title
          )}
        </span>
        <span className="chrome-url-bar-icon" style={{ opacity: 0.3 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M8 2l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" />
          </svg>
        </span>
      </div>

      {(codeReady || promptProcessing || title) && (
        <div className="relative px-2">
          <span className="bg-dark-background-01 pointer-events-none absolute top-full right-0 z-100 mt-1 rounded-sm px-2 py-1 text-sm whitespace-nowrap text-white opacity-0 transition-opacity peer-hover:opacity-100">
            New Vibe
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(ChatHeaderContent, (prevProps, nextProps) => {
  return (
    prevProps.remixOf === nextProps.remixOf &&
    prevProps.title === nextProps.title &&
    prevProps.promptProcessing === nextProps.promptProcessing &&
    prevProps.codeReady === nextProps.codeReady &&
    prevProps.icon?.cid === nextProps.icon?.cid &&
    prevProps.icon?.mime === nextProps.icon?.mime
  );
});
