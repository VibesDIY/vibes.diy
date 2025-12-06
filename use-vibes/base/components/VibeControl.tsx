import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  createVibeControlStyles,
  defaultVibeControlClasses,
  VibeControlClasses,
  VibeControlPosition,
} from '../utils/vibe-control-styles.js';

export interface VibeControlProps {
  /** Label text for the button (default: "Open Vibes") */
  readonly label?: string;

  /** Position of the button on screen */
  readonly position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /** Callback when overlay opens */
  readonly onOpen?: () => void;

  /** Callback when overlay closes */
  readonly onClose?: () => void;

  /** Custom content for the overlay */
  readonly children?: React.ReactNode;

  /** Custom CSS classes for styling */
  readonly classes?: VibeControlClasses;

  /** Whether to show the component initially (default: true) */
  readonly visible?: boolean;
}

/**
 * VibeControl - A floating action button that opens a full-screen overlay
 *
 * Features:
 * - Positioned button at corner of screen
 * - Full-screen overlay with backdrop
 * - Escape key and backdrop click to close
 * - Portal rendering to avoid z-index issues
 * - Customizable content via children prop
 */
export function VibeControl({
  label = 'Open Vibes',
  position = 'bottom-right',
  onOpen,
  onClose,
  children,
  classes = defaultVibeControlClasses,
  visible = true,
}: VibeControlProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHoveringButton, setIsHoveringButton] = React.useState(false);
  const [isHoveringClose, setIsHoveringClose] = React.useState(false);

  // Handle opening the overlay
  const handleOpen = React.useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  // Handle closing the overlay
  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scrolling when overlay is open
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scrolling
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  // Get styles with position support
  const styles = createVibeControlStyles(position as VibeControlPosition);

  const buttonStyles = {
    ...styles.button,
    ...(isHoveringButton ? styles.buttonHover : {}),
  };

  const closeButtonStyles = {
    ...styles.closeButton,
    ...(isHoveringClose ? styles.closeButtonHover : {}),
  };

  if (!visible) {
    return null;
  }

  const renderOverlay = () => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
      <div style={styles.backdrop} onClick={handleClose} className={classes.backdrop}>
        <div
          style={styles.overlay}
          onClick={(e) => e.stopPropagation()}
          className={classes.overlay}
        >
          <h2 style={styles.overlayTitle} className={classes.overlayTitle}>
            Vibe Control
          </h2>

          <button
            style={closeButtonStyles}
            onClick={handleClose}
            onMouseEnter={() => setIsHoveringClose(true)}
            onMouseLeave={() => setIsHoveringClose(false)}
            className={classes.closeButton}
            aria-label="Close overlay"
          >
            ×
          </button>

          <div style={styles.content} className={classes.content}>
            {children || (
              <div>
                <p>Welcome to Vibe Control!</p>
                <p>
                  This is the default content. You can customize this by passing children to the
                  VibeControl component.
                </p>
                <div
                  style={{
                    marginTop: '20px',
                    padding: '16px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0' }}>Example Features:</h3>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    <li>Theme customization</li>
                    <li>Settings management</li>
                    <li>Component controls</li>
                    <li>Debug information</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <button
        style={buttonStyles}
        onClick={handleOpen}
        onMouseEnter={() => setIsHoveringButton(true)}
        onMouseLeave={() => setIsHoveringButton(false)}
        className={classes.button}
        aria-label={label}
      >
        {label}
      </button>
      {renderOverlay()}
    </>
  );
}

export default VibeControl;
