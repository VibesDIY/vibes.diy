import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
import { VibesPanel } from './components/VibesPanel/VibesPanel.js';
import {
  VibeContextProvider,
  type VibeMetadata,
  validateVibeMetadata,
  VibeMetadataValidationError,
} from './contexts/VibeContext.js';

export interface MountVibesAppOptions {
  readonly container?: string | HTMLElement;
  readonly appComponent?: React.ComponentType;
  readonly showVibesSwitch?: boolean;
  readonly vibeMetadata?: VibeMetadata;
}

export interface MountVibesAppResult {
  unmount: () => void;
  getContainer: () => HTMLElement;
}

/**
 * Internal component for Vibes app mounting.
 * DO NOT use directly - use mountVibesApp() instead.
 * @internal
 */
function VibesApp({
  showVibesSwitch = true,
  vibeMetadata,
  children,
}: {
  showVibesSwitch?: boolean;
  vibeMetadata?: VibeMetadata;
  children?: React.ReactNode;
}) {
  // Conditional rendering based on showVibesSwitch:
  // - When true (vibe-viewer): Use HiddenMenuWrapper with VibesPanel for full control panel
  // - When false (result-preview): Render children directly for inline containment
  const content = showVibesSwitch ? (
    <HiddenMenuWrapper menuContent={<VibesPanel />} showVibesSwitch={true}>
      {children}
    </HiddenMenuWrapper>
  ) : (
    <>{children}</>
  );

  // Wrap in VibeContextProvider if vibeMetadata is provided
  if (vibeMetadata) {
    return <VibeContextProvider metadata={vibeMetadata}>{content}</VibeContextProvider>;
  }

  return content;
}

export function mountVibesApp(options: MountVibesAppOptions = {}): MountVibesAppResult {
  const { container: containerOption, appComponent, showVibesSwitch, vibeMetadata } = options;

  // Validate vibeMetadata if provided to prevent malformed ledger names
  if (vibeMetadata) {
    try {
      validateVibeMetadata(vibeMetadata);
    } catch (error) {
      if (error instanceof VibeMetadataValidationError) {
        throw new Error(
          `Failed to mount Vibes app: ${error.message} (code: ${error.code}). ` +
            `Received vibeMetadata: ${JSON.stringify(vibeMetadata)}`
        );
      }
      throw error;
    }
  }

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
    <VibesApp
      {...(showVibesSwitch !== undefined && { showVibesSwitch })}
      {...(vibeMetadata !== undefined && { vibeMetadata })}
    >
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
