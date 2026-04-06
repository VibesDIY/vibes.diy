import React from "react";
import type { ViewControlsType, ViewType } from "@vibes.diy/prompts";
import { SaveButton } from "./SaveButton.js";
import { ViewControls } from "./ViewControls.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";

interface ResultPreviewHeaderContentProps {
  promptState: PromptState;
  navigateToView: (view: ViewType) => void;
  viewControls: ViewControlsType;
  currentView: ViewType;
  hasCodeChanges: boolean;
  onCodeSave: () => void;
  openVibe?: () => void;
  onContextMenu?: (view: ViewType, e: React.MouseEvent) => void;
  syntaxErrorCount?: number;
  onClose?: () => void;
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
  onClose,
}: React.PropsWithChildren<ResultPreviewHeaderContentProps>) {
  return (
    <div className="vibes-header">
      <div className="vibes-header-left">
        {onClose && (
          <button
            type="button"
            className="vibes-modal-close-dot"
            onClick={onClose}
            aria-label="Close panel"
            title="Close"
          />
        )}
      </div>

      <div className="vibes-header-center" />

      <div className="vibes-header-right">
        <ViewControls
          viewControls={viewControls}
          currentView={currentView}
          onClick={navigateToView}
          onDoubleClick={(view) => view == "preview" && openVibe?.()}
          onContextMenu={onContextMenu}
        />
        {currentView === "code" && hasCodeChanges && (
          <div className="navbar-button-wrapper">
            <SaveButton
              onClick={onCodeSave}
              hasChanges={hasCodeChanges}
              syntaxErrorCount={syntaxErrorCount}
              testId="header-save-button"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultPreviewHeaderContent;
