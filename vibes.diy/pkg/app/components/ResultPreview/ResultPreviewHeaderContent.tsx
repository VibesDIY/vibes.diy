import React /*useEffect,*/ from "react"; // useEffect no longer needed here
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
// import { useViewState } from '../../utils/ViewState'; // useViewState is now lifted to home.tsx
import { BackButton } from "./BackButton.js";
import { SaveButton } from "./SaveButton.js";
import { ShareModal } from "./ShareModal.js";
import { ViewControls } from "./ViewControls.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { Button } from "../ui/button.js";
import { ShareIcon } from "../HeaderContent/SvgIcons.js";
import type { ShareModalState } from "./useShareModal.js";

interface ResultPreviewHeaderContentProps {
  promptState: PromptState;
  navigateToView: (view: ViewType) => void;
  viewControls: ViewControlsType;
  currentView: ViewType;
  hasCodeChanges: boolean;
  onCodeSave: () => void;
  shareModal: ShareModalState;
  openVibe?: () => void;
  onContextMenu?: (view: ViewType, e: React.MouseEvent) => void;
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
  shareModal,
  openVibe,
  onContextMenu,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>) {
  // console.log("Rendering ResultPreviewHeaderContent with props:", currentView, hasCodeChanges)
  return (
    <>
      <div className="flex h-full w-full items-center px-2 py-1">
        <div className="flex shrink-0 items-center justify-start">
          <BackButton
            onBackClick={() => {
              console.log("click-back");
            }}
          />
        </div>

        {/* Center - View controls */}
        <div className="flex flex-1 items-center justify-center">
          <ViewControls
            viewControls={viewControls}
            currentView={currentView}
            onClick={navigateToView}
            onDoubleClick={(view) => view == "preview" && openVibe?.()}
            onContextMenu={onContextMenu}
          />
        </div>
        {/* Right side - Save and Share buttons */}
        <div className="flex shrink-0 items-center justify-end">
          <div className="flex items-center gap-2">
            <Button ref={shareModal.buttonRef} onClick={shareModal.open} variant="blue" size="default">
              <ShareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>

            {/* Save button - show when in code view and has changes */}
            {currentView === "code" && hasCodeChanges && (
              <SaveButton
                onClick={onCodeSave}
                hasChanges={hasCodeChanges}
                syntaxErrorCount={syntaxErrorCount}
                testId="header-save-button"
              />
            )}
          </div>
        </div>
      </div>

      <ShareModal {...shareModal} />
    </>
  );
}

export default ResultPreviewHeaderContent;
