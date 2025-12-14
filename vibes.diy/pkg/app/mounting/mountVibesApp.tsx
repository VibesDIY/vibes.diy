import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { HiddenMenuWrapper } from "../components/vibes/HiddenMenuWrapper/HiddenMenuWrapper.js";
import { VibesPanel } from "../components/vibes/VibesPanel.js";
import {
  VibeContextProvider,
  validateVibeMetadata,
  VibeMetadataValidationError,
} from "@vibes.diy/use-vibes-base";
import { MountVibeParams } from "@vibes.diy/use-vibes-base/contexts/VibeContext.js";

export interface MountVibesAppOptions {
  readonly container: HTMLElement;
  readonly appComponent?: React.ComponentType;
  readonly showVibesSwitch: boolean;
  readonly mountParams: MountVibeParams;
}

export interface MountVibesAppResult {
  unmount(): void;
  getContainer(): HTMLElement;
}

/**
 * Internal component for Vibes app mounting.
 * DO NOT use directly - use mountVibesApp() instead.
 * @internal
 */
function VibesApp({
  showVibesSwitch,
  mountParams,
  children,
}: {
  showVibesSwitch: boolean;
  mountParams: MountVibeParams;
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
    return (
      <VibeContextProvider mountParams={mountParams}>
        {content}
      </VibeContextProvider>
    );

  // return content;
}

export function mountVibesApp(
  options: MountVibesAppOptions,
): MountVibesAppResult {
  const { container, appComponent, showVibesSwitch, mountParams } = options;

  // Validate vibeMetadata if provided to prevent malformed ledger names
  if (mountParams) {
    try {
      validateVibeMetadata(mountParams);
    } catch (error) {
      if (error instanceof VibeMetadataValidationError) {
        throw new Error(
          `Failed to mount Vibes app: ${error.message} (code: ${error.code}). ` +
            `Received vibeMetadata: ${JSON.stringify(mountParams)}`,
        );
      }
      throw error;
    }
  }

  const root = ReactDOM.createRoot(container);

  const AppComponent = appComponent;

  root.render(
    <VibesApp showVibesSwitch={showVibesSwitch} mountParams={mountParams}>
      {AppComponent && <AppComponent />}
    </VibesApp>,
  );

  return {
    unmount: () => {
      setTimeout(() => {
        root.unmount();
      }, 0);
    },

    getContainer: () => container,
  };
}
