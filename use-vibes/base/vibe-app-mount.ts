import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AuthWall } from './components/AuthWall/AuthWall.js';
import { useFireproof } from './index.js';
import { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';

export interface MountVibesAppOptions {
  readonly container?: string | HTMLElement;
  readonly database?: string;
  readonly title?: string;
  readonly imageUrl?: string;
}

export interface MountVibesAppResult {
  unmount: () => void;
  getContainer: () => HTMLElement;
}

function VibesApp({
  database = 'vibes-app',
  title = 'Vibes App',
  imageUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1470&q=80',
  children,
}: {
  database?: string;
  title?: string;
  imageUrl?: string;
  children?: React.ReactNode;
}) {
  const { enableSync, syncEnabled } = useFireproof(database);

  const mockLogin =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mock_login') === 'true';

  const [showAuthWall, setShowAuthWall] = React.useState(!syncEnabled && !mockLogin);

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

  React.useEffect(() => {
    setShowAuthWall(!syncEnabled && !mockLogin);
  }, [syncEnabled, mockLogin]);

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

  return React.createElement(
    HiddenMenuWrapper,
    {
      menuContent: React.createElement(VibesPanel),
    },
    children
  );
}

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

  let contentWrapper: HTMLElement | null = null;
  let originalChildren: ChildNode[] = [];

  if (containerElement === document.body) {
    const existingWrapper = document.getElementById('vibes-original-content');
    if (!existingWrapper) {
      originalChildren = Array.from(document.body.childNodes);

      contentWrapper = document.createElement('div');
      contentWrapper.id = 'vibes-original-content';
      contentWrapper.style.height = '100%';
      contentWrapper.style.width = '100%';
      contentWrapper.style.position = 'relative';

      originalChildren.forEach((child) => {
        contentWrapper!.appendChild(child);
      });

      document.body.appendChild(contentWrapper);
    } else {
      contentWrapper = existingWrapper as HTMLElement;
    }
  }

  const root = ReactDOM.createRoot(containerElement);

  root.render(
    React.createElement(
      VibesApp,
      {
        database,
        title,
        imageUrl,
      },
      React.createElement('div', {
        id: 'vibes-original-content-react',
        dangerouslySetInnerHTML: {
          __html: (contentWrapper || containerElement).innerHTML,
        },
      })
    )
  );

  return {
    unmount: () => {
      setTimeout(() => {
        root.unmount();

        if (contentWrapper && containerElement === document.body) {
          const children = Array.from(contentWrapper.childNodes);
          children.forEach((child) => {
            document.body.insertBefore(child, contentWrapper);
          });
          contentWrapper.remove();
        }

        const cleanupTarget = contentWrapper || containerElement;
        cleanupTarget.style.filter = '';
        cleanupTarget.style.pointerEvents = '';
        cleanupTarget.style.transform = '';
        cleanupTarget.style.transition = '';
        cleanupTarget.style.backgroundColor = '';
      }, 0);
    },

    getContainer: () => containerElement,
  };
}

export function mountVibesAppToBody(): MountVibesAppResult {
  return mountVibesApp();
}
