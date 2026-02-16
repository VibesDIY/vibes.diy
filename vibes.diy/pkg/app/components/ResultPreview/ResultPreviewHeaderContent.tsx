import React /*useEffect,*/ from "react"; // useEffect no longer needed here
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
// import { useViewState } from '../../utils/ViewState'; // useViewState is now lifted to home.tsx
import { BackButton } from "./BackButton.js";
import { SaveButton } from "./SaveButton.js";
import { ViewControls } from "./ViewControls.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";

interface ResultPreviewHeaderContentProps {
  promptState: PromptState;
  navigateToView: (view: ViewType) => void;
  viewControls: ViewControlsType;
  currentView: ViewType;
  hasCodeChanges: boolean;
  onCodeSave?: () => void;
  openVibe?: () => void
  // // Props from useViewState (lifted to home.tsx)
  // displayView: ViewType;
  // navigateToView: (view: ViewType) => void;
  // viewControls: ViewControlsType;
  // showViewControls: boolean;
  // previewReady: boolean;
  // setMobilePreviewShown: (shown: boolean) => void;
  // setUserClickedBack?: (clicked: boolean) => void;

  // // Props required by usePublish and useSession hooks, and for BackButton logic
  // code: string; // for usePublish
  // promptProcessing: boolean; // for BackButton logic
  // sessionId?: string; // for useSession, usePublish
  // title: TitleSrc; // for useSession, usePublish

  // // Props for code editing
  // hasCodeChanges?: boolean;
  // onCodeSave?: () => void;
  syntaxErrorCount?: number;
}

function ResultPreviewHeaderContent({
  viewControls,
  navigateToView,
  currentView,
  hasCodeChanges,
  onCodeSave,
  syntaxErrorCount,
  openVibe

  // displayView,
  // navigateToView,
  // viewControls,
  // showViewControls,
  // setMobilePreviewShown,
  // setUserClickedBack,
  // code,
  // promptProcessing,
  // sessionId: propSessionId,
  // title: propTitle,
  // hasCodeChanges,
  // onCodeSave,
  // syntaxErrorCount,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>)  {
  // const { sessionId: urlSessionId, view: urlView } = useParams();
  // const publishButtonRef = useRef<HTMLButtonElement>(null);

  // Use props if provided, otherwise use params from the URL
  // const sessionId = propSessionId || urlSessionId;
  // const title = propTitle || urlView;

  // Use the session hook to get and update session data - only if we have a sessionId
  // const { session, docs: messages, updatePublishedUrl, updateFirehoseShared } = useSession(sessionId || "temp-session");

  // useViewState is now lifted, props like displayView, navigateToView, viewControls, showViewControls are passed in.
  // The useEffect syncing activeView with displayView is no longer needed.

  // Use the custom hook for publish functionality
  // const { isPublishing, urlCopied, publishedAppUrl, handlePublish, toggleShareModal, isShareModalOpen, setIsShareModalOpen } =
  //   usePublish({
  //     sessionId,
  //     code,
  //     title: title.title,
  //     messages,
  //     updatePublishedUrl,
  //     updateFirehoseShared,
  //     publishedUrl: session.publishedUrl,
  //   });

  return (
    <div className="flex h-full w-full items-center px-2 py-4">
      <div className="flex w-1/4 items-center justify-start">
        <BackButton
          onBackClick={() => {
            console.log("click-back");
            // // Tell parent component user explicitly clicked back
            // if (promptProcessing && setUserClickedBack) {
            //   setUserClickedBack(true);
            // }
            // // Force showing the chat panel immediately
            // setMobilePreviewShown(false);
          }}
        />
        <div className="h-10" />
      </div>

      {/* Center - View controls */}
      <div className="flex w-1/2 items-center justify-center">
        <ViewControls
          viewControls={viewControls}
          currentView={currentView} // Use displayView for the currently active button highlight
          onClick={navigateToView}
          onDoubleClick={(view) => view == 'preview' && openVibe?.()}
        />
      </div>
      {/* Right side - Save and Publish buttons */}
      <div className="flex w-1/4 items-center justify-end">
        <div className="flex items-center gap-2">
          {/* Save button - show when in code view and has changes */}
          {currentView === "code" && hasCodeChanges && onCodeSave && (
            <SaveButton
              onClick={onCodeSave}
              hasChanges={hasCodeChanges}
              syntaxErrorCount={syntaxErrorCount}
              testId="header-save-button"
            />
          )}

          <div>Share is not impl</div>
          {/* <ShareButton
            ref={publishButtonRef}
            onClick={toggleShareModal}
            isPublishing={isPublishing}
            urlCopied={urlCopied}
            hasPublishedUrl={!!publishedAppUrl}
          /> */}
        </div>
      </div>
      {/* {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          buttonRef={publishButtonRef}
          publishedAppUrl={publishedAppUrl}
          onPublish={handlePublish}
          isPublishing={isPublishing}
          isFirehoseShared={session.firehoseShared}
          title={title.title}
        />
      )} */}
    </div>
  );
};

export default ResultPreviewHeaderContent;
