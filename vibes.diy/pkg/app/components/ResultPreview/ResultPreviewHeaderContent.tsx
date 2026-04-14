import React from "react";
import { useParams } from "react-router";
import { useSession } from "../../hooks/useSession.js";
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
// import { useViewState } from '../../utils/ViewState'; // useViewState is now lifted to home.tsx
import { BackButton } from "./BackButton.js";
import { SaveButton } from "./SaveButton.js";
import { ShareModal } from "./ShareModal.js";
import { useShareModal } from "./useShareModal.js";
import { ViewControls } from "./ViewControls.js";
import { Button } from "../ui/button.js";
import { ShareIcon } from "../HeaderContent/SvgIcons.js";

interface ResultPreviewHeaderContentProps {
  // Props from useViewState (lifted to home.tsx)
  displayView: ViewType;
  navigateToView: (view: ViewType) => void;
  viewControls: ViewControlsType;
  showViewControls: boolean;
  previewReady: boolean;
  setMobilePreviewShown: (shown: boolean) => void;
  setUserClickedBack?: (clicked: boolean) => void;

  // Props required by usePublish and useSession hooks, and for BackButton logic
  code: string; // for usePublish
  isStreaming: boolean; // for BackButton logic
  sessionId?: string; // for useSession, usePublish
  title?: string; // for useSession, usePublish

  // Props for code editing
  hasCodeChanges?: boolean;
  onCodeSave?: () => void;
  syntaxErrorCount?: number;
}

const ResultPreviewHeaderContent: React.FC<ResultPreviewHeaderContentProps> = ({
  displayView,
  navigateToView,
  viewControls,
  showViewControls,
  setMobilePreviewShown,
  setUserClickedBack,
  code,
  isStreaming,
  sessionId: propSessionId,
  title: propTitle,
  hasCodeChanges,
  onCodeSave,
  syntaxErrorCount,
}) => {
  const { sessionId: urlSessionId, view: urlView } = useParams();

  // Use props if provided, otherwise use params from the URL
  const sessionId = propSessionId || urlSessionId;
  const title = propTitle || urlView;

  // Use the session hook to get and update session data - only if we have a sessionId
  const {
    session,
    docs: messages,
    updatePublishedUrl,
  } = useSession(sessionId || "temp-session");

  // useViewState is now lifted, props like displayView, navigateToView, viewControls, showViewControls are passed in.
  // The useEffect syncing activeView with displayView is no longer needed.

  const shareModal = useShareModal({
    sessionId,
    code,
    title,
    messages,
    updatePublishedUrl,
    publishedUrl: session.publishedUrl,
  });

  return (
    <div className="flex h-full w-full items-center px-2 py-4">
      <div className="flex w-1/4 items-center justify-start">
        <BackButton
          onBackClick={() => {
            // Tell parent component user explicitly clicked back
            if (isStreaming && setUserClickedBack) {
              setUserClickedBack(true);
            }
            // Force showing the chat panel immediately
            setMobilePreviewShown(false);
          }}
        />

        {showViewControls ? null : <div className="h-10" />}
      </div>

      {/* Center - View controls */}
      <div className="flex w-1/2 items-center justify-center">
        {showViewControls && (
          <ViewControls
            viewControls={viewControls}
            currentView={displayView} // Use displayView for the currently active button highlight
            onClick={navigateToView}
          />
        )}
      </div>
      {/* Right side - Save and Publish buttons */}
      <div className="flex w-1/4 items-center justify-end">
        <div className="flex items-center gap-2">
          {/* Save button - show when in code view and has changes */}
          {displayView === "code" && hasCodeChanges && onCodeSave && (
            <SaveButton
              onClick={onCodeSave}
              hasChanges={hasCodeChanges}
              syntaxErrorCount={syntaxErrorCount}
              testId="header-save-button"
            />
          )}

          <Button
            ref={shareModal.buttonRef}
            onClick={shareModal.open}
            variant="blue"
            size="default"
          >
            <ShareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>
      <ShareModal {...shareModal} />
    </div>
  );
};

export default ResultPreviewHeaderContent;
