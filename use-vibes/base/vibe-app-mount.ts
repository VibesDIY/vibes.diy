import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall } from './components/AuthWall/AuthWall.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';
import { VibesSwitch } from './components/VibesSwitch/VibesSwitch.js';
import { getMenuStyle, getContentWrapperStyle } from './components/HiddenMenuWrapper/HiddenMenuWrapper.styles.js';
import { useFireproof } from './index.js';

/**
 * Options for mounting the unified Vibes app
 */
export interface MountVibesAppOptions {
  /** Container element or selector */
  readonly container?: string | HTMLElement;
  /** Database name for Fireproof */
  readonly database?: string;
  /** Custom app title for auth wall */
  readonly title?: string;
  /** Custom background image URL for auth wall */
  readonly imageUrl?: string;
}

/**
 * Return value from mountVibesApp
 */
export interface MountVibesAppResult {
  unmount: () => void;
  getContainer: () => HTMLElement;
}

/**
 * Main component that handles auth wall -> vibes switch flow
 */
function VibesApp({
  database = 'vibes-app',
  title = 'Vibes App',
  imageUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1470&q=80',
  targetContainer,
}: {
  database?: string;
  title?: string;
  imageUrl?: string;
  targetContainer?: HTMLElement;
}) {
  const { enableSync, syncEnabled } = useFireproof(database);
  
  // Check for debug flag to skip auth wall
  const mockLogin = typeof window !== 'undefined' && 
    new URLSearchParams(window.location.search).get('mock_login') === 'true';
  
  const [showAuthWall, setShowAuthWall] = React.useState(!syncEnabled && !mockLogin);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuHeight, setMenuHeight] = React.useState(0);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Watch for authentication state changes
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const isConnected = document.body.classList.contains('vibes-connect-true');
      setShowAuthWall(!isConnected);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Initial sync state check
  React.useEffect(() => {
    setShowAuthWall(!syncEnabled && !mockLogin);
  }, [syncEnabled, mockLogin]);

  const handleLogin = () => {
    enableSync();
  };

  // Set menu height on render
  React.useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [menuOpen]);

  // Effect to manage content wrapper visibility and styling (like HiddenMenuWrapper)
  React.useEffect(() => {
    if (!targetContainer) return;

    if (showAuthWall) {
      // Hide/blur the original content during auth
      Object.assign(targetContainer.style, {
        filter: 'blur(8px)',
        pointerEvents: 'none',
        transition: 'none',
        transform: 'none'
      });
    } else {
      // Apply HiddenMenuWrapper content wrapper styling
      const contentWrapperStyle = getContentWrapperStyle(menuHeight, menuOpen);
      Object.assign(targetContainer.style, contentWrapperStyle);
    }

    return () => {
      // Cleanup - restore original content wrapper
      if (targetContainer) {
        const stylesToReset = [
          'filter', 'pointerEvents', 'transform', 'transition', 
          'position', 'zIndex', 'backgroundColor', 'top', 'left', 
          'right', 'bottom', 'overflowY'
        ];
        stylesToReset.forEach(prop => {
          targetContainer.style[prop as any] = '';
        });
      }
    };
  }, [showAuthWall, targetContainer, menuOpen, menuHeight]);

  if (showAuthWall) {
    return React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'auto'
      }
    }, React.createElement(AuthWall, {
      onLogin: handleLogin,
      imageUrl,
      title,
      open: true,
    }));
  }

  // When authenticated, show just the VibesSwitch button with a menu like HiddenMenuWrapper
  return React.createElement(React.Fragment, null,
    // Menu panel (only when open) - full width at bottom like HiddenMenuWrapper
    menuOpen && React.createElement('div', {
      ref: menuRef,
      id: 'hidden-menu',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Hidden menu',
      'aria-hidden': !menuOpen,
      style: {
        ...getMenuStyle(), // Full HiddenMenuWrapper styling
        zIndex: 5, // Match HiddenMenuWrapper z-index
        pointerEvents: 'auto'
      }
    }, React.createElement(VibesPanel)),

    // VibesSwitch button with HiddenMenuWrapper styling
    React.createElement('button', {
      'aria-haspopup': 'dialog',
      'aria-expanded': menuOpen,
      'aria-controls': 'hidden-menu',
      onClick: () => setMenuOpen(!menuOpen),
      style: {
        position: 'fixed',
        bottom: '16px',
        right: '0',
        zIndex: 20, // Match HiddenMenuWrapper z-index
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        pointerEvents: 'auto'
      }
    }, React.createElement(VibesSwitch, { size: 80 }))
  );
}

/**
 * Mounts the unified Vibes app (auth wall -> vibes switch)
 */
export function mountVibesApp(options: MountVibesAppOptions = {}): MountVibesAppResult {
  const { container: containerOption, database, title, imageUrl } = options;

  let containerElement: HTMLElement;
  if (typeof containerOption === 'string') {
    const found = document.querySelector(containerOption);
    if (!found) {
      throw new Error(`VibesApp container not found: ${containerOption}`);
    }
    containerElement = found as HTMLElement;
  } else if (containerOption instanceof HTMLElement) {
    containerElement = containerOption;
  } else {
    containerElement = document.body;
  }

  // Create content wrapper and move all existing body children into it
  // This prevents our overlay from being affected by transforms
  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'vibes-content-wrapper';
  const existingChildren = Array.from(document.body.children);
  
  // Move all existing children to the wrapper
  existingChildren.forEach(child => {
    contentWrapper.appendChild(child);
  });
  document.body.appendChild(contentWrapper);

  // Create overlay portal as sibling to content wrapper
  const overlayDiv = document.createElement('div');
  overlayDiv.style.position = 'fixed';
  overlayDiv.style.inset = '0';
  overlayDiv.style.zIndex = '9999';
  overlayDiv.style.pointerEvents = 'none'; // Allow clicks through when not showing overlay
  document.body.appendChild(overlayDiv);

  const root = ReactDOM.createRoot(overlayDiv);

  // Pass the content wrapper to VibesApp for transforms
  root.render(React.createElement(VibesApp, { 
    database, 
    title, 
    imageUrl, 
    targetContainer: contentWrapper 
  }));

  return {
    unmount: () => {
      // Use setTimeout to avoid synchronous unmount during React render
      setTimeout(() => {
        root.unmount();
        if (overlayDiv.parentNode) {
          overlayDiv.parentNode.removeChild(overlayDiv);
        }
        
        // Restore original DOM structure by unwrapping content
        if (contentWrapper && contentWrapper.parentNode) {
          const children = Array.from(contentWrapper.children);
          children.forEach(child => {
            document.body.appendChild(child);
          });
          contentWrapper.parentNode.removeChild(contentWrapper);
        }
        
        // Restore original container styles
        if (containerElement && containerElement !== contentWrapper) {
          containerElement.style.filter = 'none';
          containerElement.style.pointerEvents = 'auto';
        }
      }, 0);
    },

    getContainer: () => containerElement,
  };
}

/**
 * Convenience function to mount to document.body with zero config
 */
export function mountVibesAppToBody(): MountVibesAppResult {
  return mountVibesApp();
}
