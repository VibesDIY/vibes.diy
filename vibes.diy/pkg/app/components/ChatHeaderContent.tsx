import React, { memo } from "react";
import { PILL_CLEARANCE } from "./PillPortal.js";

interface ChatHeaderContentProps {
  title: string;
  promptProcessing: boolean;
  codeReady: boolean;
  remixOf?: string;
}

function ChatHeaderContent({ title, promptProcessing, codeReady, remixOf }: ChatHeaderContentProps) {
  return (
    <div className="flex h-full w-full items-center justify-between p-2 py-4" style={{ paddingLeft: PILL_CLEARANCE }}>
      <div className="text-light-primary dark:text-dark-primary text-center text-sm">
        {remixOf ? (
          <>
            <a
              href={`/vibe/${remixOf}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-02-light dark:text-accent-02-dark hover:underline"
              title={`Remix of ${remixOf}`}
            >
              🔀
            </a>{" "}
            {title}
          </>
        ) : (
          title
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
    prevProps.codeReady === nextProps.codeReady
  );
});
