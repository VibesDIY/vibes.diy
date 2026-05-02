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
    <div className="flex h-full w-full items-center justify-between p-2 py-4" style={{ paddingLeft: PILL_CLEARANCE }}>
      <div className="text-light-primary dark:text-dark-primary flex items-center gap-2 text-center text-sm">
        {icon && (
          <img
            src={cidAssetUrl(icon.cid, icon.mime, getAppHostBaseUrl())}
            alt=""
            className="h-6 w-6 rounded-full"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        {remixOf ? (
          <span>
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
          </span>
        ) : (
          <span>{title}</span>
        )}
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
