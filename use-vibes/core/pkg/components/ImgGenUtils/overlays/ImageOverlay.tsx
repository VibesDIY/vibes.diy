import * as React from 'react';
import { combineClasses, defaultClasses, ImgGenClasses } from '../../../utils/style-utils.js';
import { PromptBar } from '../../../components/PromptBar.js';
import { ControlsBar } from '../../../components/ControlsBar.js';

interface ImageOverlayProps {
  readonly promptText: string;
  readonly editedPrompt: string | null; // null means not in edit mode

  readonly setEditedPrompt: (prompt: string | null) => void; // Set to null to exit edit mode

  readonly handlePromptEdit: (prompt: string) => void;
  /** Function to handle deletion confirmation */
  readonly handleDeleteConfirm: () => void;
  readonly handlePrevVersion: () => void;
  readonly handleNextVersion: () => void;
  readonly handleRegen: () => void;
  readonly versionIndex: number;
  readonly totalVersions: number;
  /** Custom CSS classes for styling component parts */
  readonly classes?: Partial<ImgGenClasses>;
  /** Show control buttons (defaults to true) */
  readonly showControls?: boolean;
  /** Progress value for generation (0-100), shows progress bar when < 100 */
  readonly progress?: number;
  /** Show delete button (defaults to true) */
  readonly showDelete?: boolean;
  /** Whether to show a flash effect on the version indicator - used when a new version is added */
  readonly versionFlash?: boolean;
  /** Whether regeneration is currently in progress */
  readonly isRegenerating?: boolean;
}

export function ImageOverlay({
  promptText,
  editedPrompt,
  setEditedPrompt,
  handlePromptEdit,
  handleDeleteConfirm,
  handlePrevVersion,
  handleNextVersion,
  handleRegen,
  versionIndex,
  totalVersions,
  classes = defaultClasses,
  showControls = true,
  progress = 100,
  showDelete = true,
  versionFlash = false,
  isRegenerating = false,
}: ImageOverlayProps) {
  // Normal overlay content regardless of delete confirmation state
  return (
    <div
      className={combineClasses('imggen-overlay', classes.overlay)}
      style={{ position: 'relative' }}
    >
      {
        <>
          {/* Prompt bar component */}
          <PromptBar
            promptText={promptText}
            editedPrompt={editedPrompt}
            setEditedPrompt={setEditedPrompt}
            handlePromptEdit={handlePromptEdit}
            classes={classes}
          />

          {/* Controls bar component */}
          <ControlsBar
            handleDeleteConfirm={handleDeleteConfirm}
            handlePrevVersion={handlePrevVersion}
            handleNextVersion={handleNextVersion}
            handleRegen={handleRegen}
            versionIndex={versionIndex}
            totalVersions={totalVersions}
            classes={classes}
            showControls={showControls}
            showDelete={showDelete}
            editedPrompt={editedPrompt}
            promptText={promptText}
            progress={progress}
            versionFlash={versionFlash}
            isRegenerating={isRegenerating}
          />
        </>
      }
    </div>
  );
}
