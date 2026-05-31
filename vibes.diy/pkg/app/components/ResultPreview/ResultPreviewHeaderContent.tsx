import React from "react";
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
import { BackButton } from "./BackButton.js";
import { SaveButton } from "./SaveButton.js";
import { ViewControls } from "./ViewControls.js";
import { Button } from "../ui/button.js";
import { ShareIcon } from "../HeaderContent/SvgIcons.js";
import { ShareModal } from "./ShareModal.js";
import type { PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";
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
  pendingRequestCount?: number;
  syntaxErrorCount?: number;
  onBackClick?: () => void;
  /** Forwarded to ShareModal — owners get the full sharing trio; non-owners get Copy Link + Request Access. */
  isOwner?: boolean;
  myGrant?: "owner" | "editor" | "viewer" | "submitter" | "public" | "none";
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
  pendingRequestCount = 0,
  onBackClick,
  isOwner,
  myGrant,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>) {
  return (
    <div className="flex h-full w-full items-center px-2 py-1">
      <div className="flex shrink-0 items-center justify-start">
        <BackButton
          onBackClick={() => {
            onBackClick?.();
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
          <div className="relative">
            <Button ref={shareModal.buttonRef} onClick={shareModal.open} variant="blue" size="default" aria-label="Share">
              <ShareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            {pendingRequestCount > 0 && (
              <span
                aria-label={`${pendingRequestCount} pending access request${pendingRequestCount === 1 ? "" : "s"}`}
                className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-4 h-4 rounded-full border border-black bg-cyan-400 px-1 text-[10px] font-semibold leading-none flex items-center justify-center shadow"
              >
                {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
              </span>
            )}
            {shareModal.hasUnpublishedChanges && (
              <span
                aria-label="Unpublished changes"
                className={`pointer-events-none absolute -top-1 h-2.5 w-2.5 rounded-full border border-black bg-orange-400 shadow ${
                  pendingRequestCount > 0 ? "-left-1" : "-right-1"
                }`}
              />
            )}
          </div>
        </div>
      </div>
      <ShareModal modal={shareModal} isOwner={isOwner} myGrant={myGrant} />
    </div>
  );
}

export { ResultPreviewHeaderContent };
