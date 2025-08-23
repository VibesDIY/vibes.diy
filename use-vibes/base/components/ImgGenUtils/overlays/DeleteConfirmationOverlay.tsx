import * as React from 'react';
import { combineClasses, defaultClasses, ImgGenClasses } from '../../../utils/style-utils.js';

interface DeleteConfirmationOverlayProps {
  readonly handleDeleteConfirm: () => void;
  readonly handleCancelDelete: () => void;
  /** Custom CSS classes for styling component parts */
  readonly classes?: Partial<ImgGenClasses>;
}

export function DeleteConfirmationOverlay({
  handleDeleteConfirm,
  handleCancelDelete,
  classes = defaultClasses,
}: DeleteConfirmationOverlayProps) {
  // Using React's useEffect to automatically dismiss the confirmation after 3 seconds
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleCancelDelete();
    }, 3000); // Auto-dismiss after 3 seconds

    return () => clearTimeout(timeoutId);
  }, [handleCancelDelete]);

  return (
    <div
      className={combineClasses('imggen-delete-message', classes.overlay)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        borderRadius: 'var(--imggen-border-radius)',
        padding: '10px 15px',
        marginBottom: '8px',
        textAlign: 'center',
        width: 'auto',
        boxSizing: 'border-box',
        border: '1px solid var(--imggen-error-border)',
        cursor: 'pointer',
      }}
      onClick={handleDeleteConfirm} // Click anywhere on the message to confirm delete
      aria-label="Confirm delete"
    >
      <p
        style={{
          color: '#ff3333',
          fontSize: '14px',
          margin: 0,
          fontWeight: 'bold',
        }}
      >
        Confirm delete? This action cannot be undone.
      </p>
    </div>
  );
}
