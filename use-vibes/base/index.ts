// Re-export specific items from use-fireproof
import { useEffect, useState } from 'react';
import {
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  type Database,
  type UseFpToCloudParam,
} from 'use-fireproof';
import type { ToCloudAttachable } from '@fireproof/core-types-protocols-cloud';
import { ManualRedirectStrategy } from './ManualRedirectStrategy.js';

export { fireproof, ImgFile, ManualRedirectStrategy };

// Re-export all types under a namespace
export type * as Fireproof from 'use-fireproof';

// Helper function to create toCloud configuration with ManualRedirectStrategy
export function toCloud(opts?: UseFpToCloudParam): ToCloudAttachable {
  const attachable = originalToCloud({
    ...opts,
    strategy: new ManualRedirectStrategy(),
    dashboardURI: 'https://connect.fireproof.direct/fp/cloud/api/token',
    tokenApiURI: 'https://connect.fireproof.direct/api',
    urls: { base: 'fpcloud://cloud.fireproof.direct' },
  });

  return attachable;
}

// Custom useFireproof hook with implicit cloud sync and button integration
export const useFireproof = (nameOrDatabase?: string | Database) => {
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
  }, [manualAttach, result.database, syncKey]);

  // Function to enable sync and trigger popup directly
  const enableSync = () => {
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
  };

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
  const disableSync = () => {
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
  };

  // Determine sync status - check for actual attachment state
  const syncEnabled =
    (wasSyncEnabled &&
      (result.attach?.state === 'attached' || result.attach?.state === 'attaching')) ||
    (manualAttach && typeof manualAttach === 'object' && manualAttach.state === 'attached');

  // Return combined result, preferring original attach over manual
  return {
    ...result,
    attach: result.attach || manualAttach,
    enableSync,
    disableSync,
    syncEnabled,
  };
};

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

// Export hooks
export { hashInput, useImageGen } from './hooks/image-gen/index.js';

// Export style utilities
export { defaultClasses, type ImgGenClasses } from './utils/style-utils.js';

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
export {
  type ImageDocument,
  type PartialImageDocument,
  type UseImageGenOptions,
  type UseImageGenResult,
} from './hooks/image-gen/types.js';
