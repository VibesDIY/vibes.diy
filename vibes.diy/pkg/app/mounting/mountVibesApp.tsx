import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { HiddenMenuWrapper } from "../components/vibes/HiddenMenuWrapper/HiddenMenuWrapper.js";
import { VibesPanel } from "../components/vibes/VibesPanel.js";
import {
  VibeContextProvider,
  type VibeMetadata,
  validateVibeMetadata,
  VibeMetadataValidationError,
} from "@vibes.diy/use-vibes-base";

export interface MountVibesAppOptions {
  readonly container: HTMLElement;
  readonly appComponent?: React.ComponentType;
  readonly showVibesSwitch?: boolean;
  readonly vibeMetadata?: VibeMetadata;
}

export interface MountVibesAppResult {
  unmount() : void;
  getContainer() : HTMLElement;
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
    return (
      <VibeContextProvider metadata={vibeMetadata}>
        {content}
      </VibeContextProvider>
    );
  }

  return content;
}

export function mountVibesApp(
  options: MountVibesAppOptions,
): MountVibesAppResult {
  const { container, appComponent, showVibesSwitch, vibeMetadata } = options;

  // Validate vibeMetadata if provided to prevent malformed ledger names
  if (vibeMetadata) {
    try {
      validateVibeMetadata(vibeMetadata);
    } catch (error) {
      if (error instanceof VibeMetadataValidationError) {
        throw new Error(
          `Failed to mount Vibes app: ${error.message} (code: ${error.code}). ` +
            `Received vibeMetadata: ${JSON.stringify(vibeMetadata)}`,
        );
      }
      throw error;
    }
  }

  const root = ReactDOM.createRoot(container);

  const AppComponent = appComponent;

  root.render(
    <VibesApp
      {...(showVibesSwitch !== undefined && { showVibesSwitch })}
      {...(vibeMetadata !== undefined && { vibeMetadata })}
    >
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
