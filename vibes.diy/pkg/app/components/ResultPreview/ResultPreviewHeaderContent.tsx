import React from "react";
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
import { BackButton } from "./BackButton.js";
import { SaveButton } from "./SaveButton.js";
import { ViewControls } from "./ViewControls.js";
import { Button } from "../ui/button.js";
import { ShareIcon } from "../HeaderContent/SvgIcons.js";
import { ShareModal } from "./ShareModal.js";
import type { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import type { UseShareModalReturn } from "./useShareModal.js";

interface ResultPreviewHeaderContentProps {
  promptState: PromptState;
  navigateToView: (view: ViewType) => void;
  viewControls: ViewControlsType;
  currentView: ViewType;
  hasCodeChanges: boolean;
  onCodeSave: () => void;
  openVibe?: () => void;
  onContextMenu?: (view: ViewType, e: React.MouseEvent) => void;
  shareModal: UseShareModalReturn;
  syntaxErrorCount?: number;
}

function ResultPreviewHeaderContent({
  viewControls,
  navigateToView,
  currentView,
  hasCodeChanges,
  onCodeSave,
  syntaxErrorCount,
  openVibe,
  onContextMenu,
  shareModal,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>) {
  return (
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
          {currentView === "code" && hasCodeChanges && (
            <SaveButton
              onClick={onCodeSave}
              hasChanges={hasCodeChanges}
              syntaxErrorCount={syntaxErrorCount}
              testId="header-save-button"
            />
          )}
          <Button ref={shareModal.buttonRef} onClick={shareModal.open} variant="blue" size="default" aria-label="Share">
            <ShareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>
      <ShareModal modal={shareModal} />
    </div>
  );
}

export { ResultPreviewHeaderContent };
