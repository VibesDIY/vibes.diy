import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall } from './components/AuthWall/AuthWall.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';
import { VibesSwitch } from './components/VibesSwitch/VibesSwitch.js';
import { getMenuStyle } from './components/HiddenMenuWrapper/HiddenMenuWrapper.styles.js';
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
  const [showAuthWall, setShowAuthWall] = React.useState(!syncEnabled);
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
    setShowAuthWall(!syncEnabled);
  }, [syncEnabled]);

  const handleLogin = () => {
    enableSync();
  };

  // Set menu height on render
  React.useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [menuOpen]);

  // Effect to manage target container visibility and styling
  React.useEffect(() => {
    if (!targetContainer) return;

    if (showAuthWall) {
      // Hide/blur the original content during auth
      targetContainer.style.filter = 'blur(8px)';
      targetContainer.style.pointerEvents = 'none';
      targetContainer.style.transition = 'none';
      targetContainer.style.transform = 'none';
    } else {
      // Apply HiddenMenuWrapper-style transforms when authenticated
      const duration = '0.4s';
      const easing = 'ease';
      targetContainer.style.transition = `transform ${duration} ${easing}, filter 0.3s ${easing}`;
      targetContainer.style.position = 'relative';
      targetContainer.style.zIndex = '10';
      targetContainer.style.backgroundColor = 'var(--hm-content-bg, #1e1e1e)';
      
      if (menuOpen && menuHeight > 0) {
        targetContainer.style.transform = `translateY(-${menuHeight}px)`;
        targetContainer.style.filter = 'blur(4px)';
        targetContainer.style.pointerEvents = 'none';
      } else {
        targetContainer.style.transform = 'translateY(0)';
        targetContainer.style.filter = 'none';
        targetContainer.style.pointerEvents = 'auto';
      }
    }

    return () => {
      // Cleanup - restore original content
      if (targetContainer) {
        targetContainer.style.filter = 'none';
        targetContainer.style.pointerEvents = 'auto';
        targetContainer.style.transform = 'none';
        targetContainer.style.transition = 'none';
        targetContainer.style.position = '';
        targetContainer.style.zIndex = '';
        targetContainer.style.backgroundColor = '';
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

  // Leave existing content in place and create overlay portal
  const overlayDiv = document.createElement('div');
  overlayDiv.style.position = 'fixed';
  overlayDiv.style.inset = '0';
  overlayDiv.style.zIndex = '9999';
  overlayDiv.style.pointerEvents = 'none'; // Allow clicks through when not showing overlay
  document.body.appendChild(overlayDiv);

  const root = ReactDOM.createRoot(overlayDiv);

  // Pass the original container element to VibesApp so it can wrap the existing content
  root.render(React.createElement(VibesApp, { 
    database, 
    title, 
    imageUrl, 
    targetContainer: containerElement 
  }));

  return {
    unmount: () => {
      // Use setTimeout to avoid synchronous unmount during React render
      setTimeout(() => {
        root.unmount();
        if (overlayDiv.parentNode) {
          overlayDiv.parentNode.removeChild(overlayDiv);
        }
        // Restore original container styles
        if (containerElement) {
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
