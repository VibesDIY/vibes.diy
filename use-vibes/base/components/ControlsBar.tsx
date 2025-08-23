import * as React from 'react';
import { combineClasses, defaultClasses, ImgGenClasses } from '../utils/style-utils.js';
import { imgGenStyles, imgGenTheme } from '../utils/styles.js';
import { logDebug } from '../utils/debug.js';

interface ControlsBarProps {
  /** Handle delete confirmation */
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
  /** Edited prompt for highlighting regenerate button */
  readonly editedPrompt: string | null;
  /** Original prompt text for comparison */
  readonly promptText: string;
  /** Progress value for generation (0-100), shows progress bar when < 100 */
  readonly progress?: number;
  /** Show delete button (defaults to true) */
  readonly showDelete?: boolean;

  /** Whether to flash the version indicator when a new version is added */
  readonly versionFlash?: boolean;
  /** Whether the regeneration is currently in progress */
  readonly isRegenerating?: boolean;
}

/**
 * ControlsBar component - Displays controls for deleting, navigating between versions, and regenerating
 */
export function ControlsBar({
  handleDeleteConfirm,
  handlePrevVersion,
  handleNextVersion,
  handleRegen,
  versionIndex,
  totalVersions,
  classes = defaultClasses,
  showControls = true,
  editedPrompt,
  promptText,
  progress = 100,
  showDelete = true,
  versionFlash = false,
  isRegenerating = false,
}: ControlsBarProps) {
  // State for managing delete confirmation
  const [showConfirmation, setShowConfirmation] = React.useState(false);

  // Timer ref for automatic cancellation
  const cancelTimerRef = React.useRef<number | null>(null);

  // Use external state if provided
  const isConfirming = showConfirmation;

  // Handle delete click
  const onDeleteClick = () => {
    if (isConfirming) {
      // User clicked delete while confirmation is showing - confirm the delete
      logDebug('ControlsBar: Delete confirmed, calling handleDeleteConfirm');
      // Ensure we call handleDeleteConfirm with no arguments, it will handle the document ID
      handleDeleteConfirm();

      // Reset confirmation state
      setShowConfirmation(false);
      if (cancelTimerRef.current) {
        window.clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = null;
      }
    } else {
      // Show confirmation
      logDebug('ControlsBar: Showing delete confirmation');
      setShowConfirmation(true);

      // Set timer to auto-hide confirmation after 6.5 seconds (allows 0.5s for fade)
      cancelTimerRef.current = window.setTimeout(() => {
        setShowConfirmation(false);
      }, 6500);
    }
  };

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (cancelTimerRef.current) {
        window.clearTimeout(cancelTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Progress bar for generation progress - explicitly positioned at the top */}
      {progress < 100 && (
        <div
          className="imggen-progress"
          style={{
            width: `${progress}%`,
            position: 'absolute',
            top: 0,
            left: 0,
            height: 'var(--imggen-progress-height)',
            zIndex: 20,
          }}
        />
      )}

      {/* Bottom row with controls or status */}
      <div className={combineClasses('imggen-controls', classes.controls)}>
        {showControls ? (
          <>
            {/* Left side: Delete button */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
              {showDelete && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    aria-label="Delete image"
                    onClick={onDeleteClick}
                    className={combineClasses('imggen-button imggen-delete-button', classes.button)}
                    style={{
                      position: 'static',
                      width: 'var(--imggen-button-size)',
                      height: 'var(--imggen-button-size)',
                      backgroundColor: isConfirming ? 'var(--imggen-error-border)' : undefined,
                      color: isConfirming ? 'white' : undefined,
                      opacity: isConfirming ? 1 : undefined,
                    }}
                  >
                    ✕
                  </button>
                  {isConfirming && (
                    <div className="fade-transition" style={{ animationDelay: '6s' }}>
                      <button
                        onClick={() => {
                          handleDeleteConfirm();
                          setShowConfirmation(false);
                        }}
                        aria-label="Confirm delete"
                        style={{
                          fontSize: 'var(--imggen-font-size)',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          border: '1px solid var(--imggen-error-border, #ff3333)',
                          background: 'var(--imggen-error-border, #ff3333)',
                          color: 'white',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '2px 8px',
                        }}
                      >
                        Delete image?
                      </button>
                      <button
                        onClick={() => {
                          logDebug('ControlsBar: Delete canceled');
                          setShowConfirmation(false);
                          if (cancelTimerRef.current) {
                            window.clearTimeout(cancelTimerRef.current);
                          }
                        }}
                        aria-label="Cancel delete"
                        style={{
                          fontSize: 'var(--imggen-font-size)',
                          whiteSpace: 'nowrap',
                          border: 'none',
                          background: 'none',
                          color: 'var(--imggen-font-color)',
                          cursor: 'pointer',
                          padding: '0 4px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right side: Version controls */}
            <div className="imggen-control-group">
              {/* Previous version button - only when multiple versions */}
              {totalVersions > 1 && (
                <button
                  aria-label="Previous version"
                  disabled={versionIndex === 0}
                  onClick={handlePrevVersion}
                  className={combineClasses('imggen-button', classes.button)}
                >
                  ◀︎
                </button>
              )}

              {/* Version indicator - only display if we have versions */}
              {totalVersions > 1 && (
                <span
                  className={`imggen-version-indicator version-indicator ${
                    versionFlash ? 'imggen-version-flash' : ''
                  }`}
                  aria-live="polite"
                >
                  {versionIndex + 1} / {totalVersions}
                </span>
              )}

              {/* Next version button - only when multiple versions */}
              {totalVersions > 1 && (
                <button
                  aria-label="Next version"
                  disabled={versionIndex >= totalVersions - 1}
                  onClick={handleNextVersion}
                  className={combineClasses('imggen-button', classes.button)}
                >
                  ▶︎
                </button>
              )}

              {/* Regenerate button - always visible */}
              {/* Debug logs moved to useEffect */}
              <button
                aria-label="Regenerate image"
                onClick={() => {
                  handleRegen();
                }}
                disabled={isRegenerating}
                className={combineClasses(
                  'imggen-button',
                  classes.button,
                  editedPrompt !== null && editedPrompt.trim() !== promptText
                    ? 'imggen-button-highlight'
                    : '',
                  isRegenerating ? 'imggen-button-disabled' : ''
                )}
              >
                <span className={isRegenerating ? 'imggen-regen-spinning' : ''}>⟳</span>
              </button>
            </div>
          </>
        ) : progress < 100 ? (
          <div className="imggen-status-text">Generating...</div>
        ) : null}
      </div>
    </>
  );
}
