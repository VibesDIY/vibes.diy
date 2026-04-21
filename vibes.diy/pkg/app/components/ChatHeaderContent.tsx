import React, { memo, useEffect, useState } from "react";
import { PILL_CLEARANCE } from "./PillPortal.js";

interface ChatHeaderContentProps {
  title: string;
  promptProcessing: boolean;
  codeReady: boolean;
  remixOf?: string;
  userSlug?: string;
  appSlug?: string;
}

function ChatHeaderContent({ title, promptProcessing, codeReady, remixOf, userSlug, appSlug }: ChatHeaderContentProps) {
  const [iconFailed, setIconFailed] = useState(false);
  useEffect(() => {
    setIconFailed(false);
  }, [userSlug, appSlug]);
  const iconSrc = userSlug && appSlug && !iconFailed ? `/vibes-icon/${userSlug}/${appSlug}` : undefined;

  return (
    <div className="flex h-full w-full items-center justify-between p-2 py-4" style={{ paddingLeft: PILL_CLEARANCE }}>
      <div className="text-light-primary dark:text-dark-primary flex items-center gap-2 text-center text-sm">
        {iconSrc ? (
          <img src={iconSrc} alt="" className="h-5 w-5 rounded-sm" onError={() => setIconFailed(true)} />
        ) : null}
        {remixOf ? (
          <span>
            <a
              href={`https://${remixOf}.vibesdiy.app/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-02-light dark:text-accent-02-dark hover:underline"
            >
              🔀
            </a>{" "}
            {title}
          </span>
        ) : (
          <span>{title}</span>
        )}
      </div>

      {(codeReady || promptProcessing || title) && (
        <div className="relative px-2">
          {/* <a
            href="/"
            className="peer bg-accent-02-light dark:bg-accent-02-dark hover:bg-accent-03-light dark:hover:bg-accent-03-dark flex cursor-pointer items-center justify-center rounded-full p-2.5 text-white transition-colors"
            aria-label="New Vibe"
            title="New Vibe"
          >
            <span className="sr-only">New Vibe</span>
            <EditIcon />
          </a> */}
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
    prevProps.userSlug === nextProps.userSlug &&
    prevProps.appSlug === nextProps.appSlug
  );
});
