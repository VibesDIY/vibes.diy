import type { ToCloudAttachable } from '@fireproof/core-types-protocols-cloud';
import { useCallback, useEffect, useState, useId } from 'react';
import {
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  type Database,
  type UseFpToCloudParam,
} from 'use-fireproof';
import { ManualRedirectStrategy } from './ManualRedirectStrategy.js';

// Track sync status by database name and instance ID
const syncEnabledInstances = new Map<string, Set<string>>();

// Helper to update body class based on global sync status
function updateBodyClass() {
  if (typeof window === 'undefined' || !document?.body) return;

  const hasAnySyncEnabled = Array.from(syncEnabledInstances.values()).some(
    (instanceSet) => instanceSet.size > 0
  );

  if (hasAnySyncEnabled) {
    document.body.classList.add('vibes-connect-true');
  } else {
    document.body.classList.remove('vibes-connect-true');
  }
}

export { fireproof, ImgFile, ManualRedirectStrategy };

// Re-export all types under a namespace
export type * as Fireproof from 'use-fireproof';

// Helper function to create toCloud configuration with ManualRedirectStrategy
export function toCloud(opts?: UseFpToCloudParam): ToCloudAttachable {
  const attachable = originalToCloud({
    ...opts,
    strategy: new ManualRedirectStrategy(),
    dashboardURI: 'https://connect.fireproof.direct/fp/cloud/api/token-auto',
    tokenApiURI: 'https://connect.fireproof.direct/api',
    urls: { base: 'fpcloud://cloud.fireproof.direct' },
  });

  return attachable;
}

// Custom useFireproof hook with implicit cloud sync and button integration
export function useFireproof(nameOrDatabase?: string | Database) {
  // Generate unique instance ID for this hook instance
  const instanceId = useId();

  // Get database name for localStorage key
  const dbName =
    typeof nameOrDatabase === 'string' ? nameOrDatabase : nameOrDatabase?.name || 'default';
  const syncKey = `fireproof-sync-${dbName}`;

  // Check if sync was previously enabled (persists across refreshes)
  const wasSyncEnabled = typeof window !== 'undefined' && localStorage.getItem(syncKey) === 'true';

  // Create attach config only if sync was previously enabled
  const attachConfig = wasSyncEnabled ? toCloud() : undefined;

  // Use original useFireproof with attach config only if previously enabled
  // This preserves the createAttach lifecycle for token persistence
  const result = originalUseFireproof(
    nameOrDatabase as string | Database | undefined,
    attachConfig ? { attach: attachConfig } : {}
  );

  // State to track manual attachment for first-time enable
  const [manualAttach, setManualAttach] = useState<
    null | 'pending' | { state: 'attached' | 'error'; attached?: unknown; error?: unknown }
  >(null);

  // Handle first-time sync enable without reload
  useEffect(() => {
    if (manualAttach === 'pending' && result.database) {
      const cloudConfig = toCloud();
      result.database
        .attach(cloudConfig)
        .then((attached) => {
          setManualAttach({ state: 'attached', attached });
          // Save preference for next refresh
          localStorage.setItem(syncKey, 'true');
        })
        .catch((error) => {
          console.error('Failed to attach:', error);
          setManualAttach({ state: 'error', error });
        });
    }
  }, [manualAttach, result.database, syncKey, dbName]);

  // Function to enable sync and trigger popup directly
  const enableSync = useCallback(() => {
    if (!wasSyncEnabled && !manualAttach) {
      // First time enabling - manual attach
      setManualAttach('pending');
    }

    // After a short delay, programmatically click the sign-in link in the overlay
    setTimeout(() => {
      const authLink = document.querySelector('.fpOverlay a[href]') as HTMLAnchorElement;
      if (authLink) {
        authLink.click();

        // Hide the overlay after clicking since we're opening the popup
        const overlay = document.querySelector('.fpOverlay') as HTMLElement;
        if (overlay) {
          overlay.style.display = 'none';
        }
      }
    }, 100); // Small delay to ensure overlay is rendered
  }, [wasSyncEnabled, manualAttach]);

  // Wire up vibes-login-link button if it exists
  useEffect(() => {
    const button = document.getElementById('vibes-login-link');
    if (!button) return;

    const handleClick = () => {
      enableSync();
    };

    button.addEventListener('click', handleClick);

    // Cleanup removes this listener on unmount
    return () => {
      button.removeEventListener('click', handleClick);
    };
  }, [enableSync]);

  // Function to disable sync
  const disableSync = useCallback(() => {
    localStorage.removeItem(syncKey);

    // Reset token if attached through original flow
    if (
      result.attach?.ctx?.tokenAndClaims?.state === 'ready' &&
      result.attach.ctx.tokenAndClaims.reset
    ) {
      result.attach.ctx.tokenAndClaims.reset();
    }

    // Clear manual attach state
    setManualAttach(null);
  }, [syncKey, result.attach]);

  // Determine sync status - check for actual attachment state
  const syncEnabled =
    (wasSyncEnabled &&
      (result.attach?.state === 'attached' || result.attach?.state === 'attaching')) ||
    (manualAttach && typeof manualAttach === 'object' && manualAttach.state === 'attached');

  // Manage global sync status tracking and body class
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ensure database entry exists in Map
    if (!syncEnabledInstances.has(dbName)) {
      syncEnabledInstances.set(dbName, new Set());
    }
    const instanceSet = syncEnabledInstances.get(dbName);
    if (!instanceSet) return;

    if (syncEnabled) {
      // Add this instance to the sync-enabled set
      instanceSet.add(instanceId);
    } else {
      // Remove this instance from the sync-enabled set
      instanceSet.delete(instanceId);
    }

    // Update body class based on global sync status
    updateBodyClass();

    // Cleanup on unmount - remove this instance
    return () => {
      const currentInstanceSet = syncEnabledInstances.get(dbName);
      if (currentInstanceSet) {
        currentInstanceSet.delete(instanceId);
        // Clean up empty sets
        if (currentInstanceSet.size === 0) {
          syncEnabledInstances.delete(dbName);
        }
        updateBodyClass();
      }
    };
  }, [syncEnabled, dbName, instanceId]);

  // Return combined result, preferring original attach over manual
  return {
    ...result,
    attach: result.attach || manualAttach,
    enableSync,
    disableSync,
    syncEnabled,
  };
}

// Re-export specific functions and types from call-ai
import { callAI } from 'call-ai';
export { callAI, callAI as callAi };

// Re-export all types under a namespace
export type * as CallAI from 'call-ai';

// Export ImgGen component - the primary export
export { default as ImgGen } from './components/ImgGen.js';
export type { ImgGenProps } from './components/ImgGen.js';

// Export all components for testing and advanced usage
export { ControlsBar } from './components/ControlsBar.js';
export { PromptBar } from './components/PromptBar.js';
export { VibesSwitch } from './components/VibesSwitch/VibesSwitch.js';
export { VibesButton } from './components/VibesButton/VibesButton.js';

// Export hooks
export { hashInput, useImageGen } from './hooks/image-gen/index.js';

// Export style utilities
export { defaultClasses } from './utils/style-utils.js';

export type { ImgGenClasses } from '@vibes.diy/use-vibes-types';

// Export utility functions
export { base64ToFile } from './utils/base64.js';

// Export ImgGen sub-components
export { ImgGenDisplay } from './components/ImgGenUtils/ImgGenDisplay.js';
export { ImgGenDisplayPlaceholder } from './components/ImgGenUtils/ImgGenDisplayPlaceholder.js';
export { ImgGenModal, type ImgGenModalProps } from './components/ImgGenUtils/ImgGenModal.js';
export { ImageOverlay } from './components/ImgGenUtils/overlays/ImageOverlay.js';

// Export internal utilities and constants
export { addNewVersion, MODULE_STATE } from './hooks/image-gen/utils.js';

// Export types for testing and advanced usage
export type {
  ImageDocument,
  PartialImageDocument,
  UseImageGenOptions,
  UseImageGenResult,
} from '@vibes.diy/use-vibes-types';

// Export useVibes hook and types
export { useVibes } from './hooks/vibes-gen/index.js';
export type { UseVibesOptions, UseVibesResult, VibeDocument } from '@vibes.diy/use-vibes-types';

// Export VibeControl component and utilities
export { VibeControl } from './components/VibeControl.js';
export type { VibeControlProps } from './components/VibeControl.js';
export {
  mountVibeControl,
  mountVibeControlToBody,
  autoMountVibeControl,
} from './vibe-control-mount.js';
export type { MountVibeControlOptions, MountVibeControlResult } from './vibe-control-mount.js';

// Export HiddenMenuWrapper component and utilities
export { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
export type { HiddenMenuWrapperProps } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
export {
  mountHiddenMenuWrapper,
  mountHiddenMenuWrapperToBody,
  autoMountHiddenMenuWrapper,
} from './vibe-hidden-menu-mount.js';
export type {
  MountHiddenMenuWrapperOptions,
  MountHiddenMenuWrapperResult,
} from './vibe-hidden-menu-mount.js';

// Export AuthWall component and utilities
export { AuthWall } from './components/AuthWall/AuthWall.js';
export type { AuthWallProps } from './components/AuthWall/AuthWall.js';
export {
  mountAuthWall,
} from './vibe-auth-wall.js';
export type { MountAuthWallOptions, MountAuthWallResult } from './vibe-auth-wall.js';
export {
  vibeControlTheme,
  createVibeControlStyles,
  defaultVibeControlClasses,
} from './utils/vibe-control-styles.js';
export type { VibeControlClasses } from './utils/vibe-control-styles.js';
export { hiddenMenuTheme } from './components/HiddenMenuWrapper/HiddenMenuWrapper.styles.js';
