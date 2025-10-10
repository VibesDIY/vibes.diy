import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall, type AuthWallProps } from './components/AuthWall/AuthWall.js';
import { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';
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
}: {
  database?: string;
  title?: string;
  imageUrl?: string;
}) {
  const { enableSync, syncEnabled } = useFireproof(database);
  const [showAuthWall, setShowAuthWall] = React.useState(!syncEnabled);

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

  if (showAuthWall) {
    return React.createElement(AuthWall, {
      onLogin: handleLogin,
      imageUrl,
      title,
      open: true,
    });
  }

  return React.createElement(HiddenMenuWrapper, {
    children: null,
    menuContent: React.createElement(VibesPanel),
  });
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

  const mountDiv = document.createElement('div');
  containerElement.appendChild(mountDiv);

  const root = ReactDOM.createRoot(mountDiv);

  root.render(React.createElement(VibesApp, { database, title, imageUrl }));

  return {
    unmount: () => {
      root.unmount();
      if (mountDiv.parentNode) {
        mountDiv.parentNode.removeChild(mountDiv);
      }
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
