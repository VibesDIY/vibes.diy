import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall } from './components/AuthWall/AuthWall.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';
import { VibesSwitch } from './components/VibesSwitch/VibesSwitch.js';
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

  // Effect to manage target container visibility and styling
  React.useEffect(() => {
    if (!targetContainer) return;

    if (showAuthWall) {
      // Hide/blur the original content during auth
      targetContainer.style.filter = 'blur(8px)';
      targetContainer.style.pointerEvents = 'none';
    } else {
      // Show original content clearly when authenticated
      targetContainer.style.filter = 'none';
      targetContainer.style.pointerEvents = 'auto';
    }

    return () => {
      // Cleanup - restore original content
      if (targetContainer) {
        targetContainer.style.filter = 'none';
        targetContainer.style.pointerEvents = 'auto';
      }
    };
  }, [showAuthWall, targetContainer]);

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

  // When authenticated, show just the VibesSwitch button with a simple menu
  return React.createElement(React.Fragment, null,
    // Menu panel (only when open)
    menuOpen && React.createElement('div', {
      style: {
        position: 'fixed',
        bottom: '100px',
        right: '16px',
        zIndex: 9997,
        pointerEvents: 'auto'
      }
    }, React.createElement(VibesPanel)),

    // VibesSwitch button
    React.createElement('div', {
      style: {
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9998,
        pointerEvents: 'auto'
      }
    }, React.createElement('button', {
      onClick: () => setMenuOpen(!menuOpen),
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer'
      }
    }, React.createElement(VibesSwitch, { size: 80 })))
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
