import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall } from './components/AuthWall/AuthWall.js';
import { VIBES_SYNC_ENABLE_EVENT, VIBES_SYNC_ENABLED_CLASS } from './constants.js';
import { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';

export interface MountVibesAppOptions {
  readonly container?: string | HTMLElement;
  readonly title?: string;
  readonly imageUrl?: string;
  readonly appComponent?: React.ComponentType;
}

export interface MountVibesAppResult {
  unmount: () => void;
  getContainer: () => HTMLElement;
}

function VibesApp({
  title = 'Vibes App',
  imageUrl = '/screenshot.png',
  children,
}: {
  title?: string;
  imageUrl?: string;
  children?: React.ReactNode;
}) {
  // Check if sync is already enabled globally by checking body class
  const syncEnabled =
    typeof window !== 'undefined' && document.body.classList.contains(VIBES_SYNC_ENABLED_CLASS);

  // Check if sync was previously enabled in localStorage
  const wasSyncEnabled =
    typeof window !== 'undefined' && localStorage.getItem('fireproof-sync-enabled') === 'true';

  const mockLogin =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mock_login') === 'true';

  // Don't show AuthWall if sync was previously enabled, is currently enabled, or mockLogin is active
  const [showAuthWall, setShowAuthWall] = React.useState(
    !syncEnabled && !mockLogin && !wasSyncEnabled
  );

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const isConnected = document.body.classList.contains(VIBES_SYNC_ENABLED_CLASS);
      setShowAuthWall(!isConnected && !mockLogin);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [mockLogin]);

  const handleLogin = () => {
    // Dispatch global sync enable event - app's useFireproof will handle it
    document.dispatchEvent(new CustomEvent(VIBES_SYNC_ENABLE_EVENT));
  };

  // Render both app component (to register event listener) and AuthWall (as overlay)
  // App component must mount first so its useFireproof listener exists when login is clicked
  return (
    <>
      <div style={showAuthWall ? { display: 'none' } : undefined}>
        <HiddenMenuWrapper menuContent={<VibesPanel />}>{children}</HiddenMenuWrapper>
      </div>
      <AuthWall onLogin={handleLogin} imageUrl={imageUrl} title={title} open={showAuthWall} />
    </>
  );
}

export function mountVibesApp(options: MountVibesAppOptions = {}): MountVibesAppResult {
  const { container: containerOption, title, imageUrl, appComponent } = options;

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

  let contentWrapper: HTMLElement | null = null;
  let originalChildren: ChildNode[] = [];

  // Only preserve existing DOM content when appComponent is not provided
  if (containerElement === document.body && !appComponent) {
    const existingWrapper = document.getElementById('vibes-original-content');
    if (!existingWrapper) {
      originalChildren = Array.from(document.body.childNodes);

      contentWrapper = document.createElement('div');
      contentWrapper.id = 'vibes-original-content';
      contentWrapper.style.height = '100%';
      contentWrapper.style.width = '100%';
      contentWrapper.style.position = 'relative';

      originalChildren.forEach((child) => {
        if (contentWrapper) {
          contentWrapper.appendChild(child);
        }
      });

      document.body.appendChild(contentWrapper);
    } else {
      contentWrapper = existingWrapper as HTMLElement;
    }
  }

  const root = ReactDOM.createRoot(containerElement);

  const AppComponent = appComponent;

  root.render(
    <VibesApp {...(title !== undefined && { title })} {...(imageUrl !== undefined && { imageUrl })}>
      {/* If appComponent is provided, render it instead of preserving DOM */}
      {AppComponent ? (
        <AppComponent />
      ) : contentWrapper ? (
        <div
          ref={(node: HTMLDivElement | null) => {
            if (node && contentWrapper && node.children.length === 0) {
              // Move original content into React-managed container
              node.appendChild(contentWrapper);
            }
          }}
          style={{ height: '100%', width: '100%' }}
        />
      ) : null}
    </VibesApp>
  );

  return {
    unmount: () => {
      setTimeout(() => {
        root.unmount();

        if (contentWrapper && containerElement === document.body) {
          const children = Array.from(contentWrapper.childNodes);
          const wrapperInDom = document.body.contains(contentWrapper);
          for (const child of children) {
            if (wrapperInDom) {
              // Restore original order relative to the wrapper if it still exists
              document.body.insertBefore(child, contentWrapper);
            } else {
              // Wrapper was already detached by React; append children back to body
              document.body.appendChild(child);
            }
          }
          if (wrapperInDom) {
            contentWrapper.remove();
          }
        }

        const targets: HTMLElement[] = [];
        if (containerElement instanceof HTMLElement) targets.push(containerElement);
        if (contentWrapper instanceof HTMLElement) targets.push(contentWrapper);
        for (const el of targets) {
          el.style.filter = '';
          el.style.pointerEvents = '';
          el.style.transform = '';
          el.style.transition = '';
          el.style.backgroundColor = '';
        }
      }, 0);
    },

    getContainer: () => containerElement,
  };
}

export function mountVibesAppToBody(): MountVibesAppResult {
  return mountVibesApp();
}
