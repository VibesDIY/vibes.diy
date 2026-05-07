import React from "react";
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
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
  onBackClick?: () => void;
  isChatActive?: boolean;
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
  onBackClick,
  isChatActive,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>) {
  return (
    <div className="flex h-full w-full items-center gap-2 px-1 py-1 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-2 md:px-0">
      <div aria-hidden="true" className="hidden md:block" />
      {/* Center - View controls */}
      <div className="flex flex-1 items-center justify-center md:flex-initial">
        <ViewControls
          viewControls={viewControls}
          currentView={currentView}
          onClick={navigateToView}
          onDoubleClick={(view) => view == "preview" && openVibe?.()}
          onContextMenu={onContextMenu}
          onChatClick={onBackClick}
          isChatActive={isChatActive}
        />
      </div>
      {/* Right side - Save and Share buttons */}
      <div className="flex shrink-0 items-center justify-end gap-2 pr-1 md:pr-2">
        {currentView === "code" && hasCodeChanges && (
          <SaveButton
            onClick={onCodeSave}
            hasChanges={hasCodeChanges}
            syntaxErrorCount={syntaxErrorCount}
            testId="header-save-button"
          />
        )}
        <div className="relative">
          <Button ref={shareModal.buttonRef} onClick={shareModal.open} variant="blue" size="default" aria-label="Share">
            <ShareIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          {shareModal.hasUnpublishedChanges && (
            <span
              aria-label="Unpublished changes"
              className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-black bg-orange-400 shadow"
            />
          )}
        </div>
      </div>
      <ShareModal modal={shareModal} />
    </div>
  );
}

export { ResultPreviewHeaderContent };
