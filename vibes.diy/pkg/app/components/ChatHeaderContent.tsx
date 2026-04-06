import React, { memo } from "react";

interface ChatHeaderContentProps {
  onOpenSidebar: () => void;
  title: string;
  promptProcessing: boolean;
  codeReady: boolean;
  remixOf?: string;
}

function ChatHeaderContent({ title, remixOf }: ChatHeaderContentProps) {
  return (
    <div className="vibes-chrome-url-bar">
      <span className="vibes-chrome-url-bar-icon">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="5" x2="8" y2="8.5" />
          <circle cx="8" cy="11" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="vibes-app-name-display">
        {remixOf ? (
          <>
            <a
              href={`https://${remixOf}.vibesdiy.app/`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "var(--vibes-blue)" }}
            >
              🔀
            </a>{" "}
            {title}
          </>
        ) : (
          title
        )}
      </span>
    </div>
  );
}

export default memo(ChatHeaderContent, (prevProps, nextProps) => {
  return (
    prevProps.remixOf === nextProps.remixOf &&
    prevProps.onOpenSidebar === nextProps.onOpenSidebar &&
    prevProps.title === nextProps.title &&
    prevProps.promptProcessing === nextProps.promptProcessing &&
    prevProps.codeReady === nextProps.codeReady
  );
});
