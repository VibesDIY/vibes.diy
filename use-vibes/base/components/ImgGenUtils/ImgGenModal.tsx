import * as React from 'react';
import { DocFileMeta } from '@fireproof/use-fireproof';
import { AsyncImg } from './AsyncImg.js';
import { createPortal } from 'react-dom';
import { ImageOverlay } from './overlays/ImageOverlay.js';
import { ImgGenError } from './ImgGenError.js';
import { defaultClasses, ImgGenClasses } from '../../utils/style-utils.js';

export interface ImgGenModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentFile: DocFileMeta | undefined; // DocFileMeta object from Fireproof
  readonly alt?: string;
  readonly promptText: string;
  readonly editedPrompt: string | null;

  readonly setEditedPrompt: (_editedPrompt: string | null) => void;

  readonly handlePromptEdit: (_newPrompt: string) => void;
  readonly handleDeleteConfirm: () => void;
  readonly handlePrevVersion: () => void;
  readonly handleNextVersion: () => void;
  readonly handleRegen: () => void;
  readonly versionIndex: number;
  readonly totalVersions: number;
  readonly progress: number;
  /** Whether to show a flash effect on the version indicator - used when a new version is added */
  readonly versionFlash?: boolean;
  readonly isRegenerating?: boolean;
  /** Error if image generation failed */
  readonly error?: Error | null;
  readonly classes?: Partial<ImgGenClasses>;
}

export function ImgGenModal({
  isOpen,
  onClose,
  currentFile,
  alt,
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
  progress,
  versionFlash = false,
  isRegenerating = false,
  error = null,
  classes = defaultClasses,
}: ImgGenModalProps) {
  // ESC handling while modal is open
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !currentFile) {
    return null;
  }

  // Determine what prompt to show in the modal
  const effectivePromptText = promptText;

  return createPortal(
    <div
      className="imggen-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent click from propagating beyond
        onClose();
      }}
      role="presentation"
    >
      <figure
        className="imggen-full-wrapper"
        role="figure"
        style={{
          position: 'relative',
          margin: 0,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <div
            className="imggen-backdrop-error"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              padding: '2rem',
            }}
          >
            <ImgGenError message={error.message} />
          </div>
        ) : (
          <AsyncImg
            file={currentFile}
            className="imggen-backdrop-image"
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
              display: 'block',
            }}
            alt={alt || 'Generated image'}
          />
        )}
        {/* Overlay as caption */}
        <ImageOverlay
          promptText={effectivePromptText}
          editedPrompt={editedPrompt}
          setEditedPrompt={setEditedPrompt}
          handlePromptEdit={handlePromptEdit}
          handleDeleteConfirm={handleDeleteConfirm}
          handlePrevVersion={handlePrevVersion}
          handleNextVersion={handleNextVersion}
          handleRegen={handleRegen}
          versionIndex={versionIndex}
          totalVersions={totalVersions}
          progress={progress}
          versionFlash={versionFlash}
          isRegenerating={isRegenerating}
          classes={classes}
          showDelete={true}
        />
      </figure>
    </div>,
    globalThis.document.body
  );
}
