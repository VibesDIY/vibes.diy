import type { ToCloudAttachable } from '@fireproof/core-types-protocols-cloud';
import { getKeyBag } from '@fireproof/core-keybag';
import { Lazy } from '@adviser/cement';
import { ensureSuperThis } from '@fireproof/core-runtime';
import { useCallback, useEffect, useState } from 'react';
import {
  Attached,
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  RedirectStrategy,
  type Database,
  type UseFpToCloudParam,
} from 'use-fireproof';
import {
  VIBES_SYNC_ENABLE_EVENT,
  VIBES_SYNC_DISABLE_EVENT,
  VIBES_SYNC_ENABLED_CLASS,
  VIBES_SYNC_ERROR_EVENT,
} from './constants.js';
import { useVibeContext, type VibeMetadata } from './contexts/VibeContext.js';

// Interface for share API response
interface ShareApiResponse {
  success: boolean;
  email: string;
  role: string;
  right: string;
  message?: string;
}

// Track sync status by database name and instance ID
const syncEnabledInstances = new Map<string, Set<string>>();

// Simple counter for generating unique instance IDs (avoids React.useId conflicts)
let instanceCounter = 0;

// Helper to update body class based on global sync status
function updateBodyClass() {
  if (typeof window === 'undefined' || !document?.body) return;

  const hasAnySyncEnabled = Array.from(syncEnabledInstances.values()).some(
    (instanceSet) => instanceSet.size > 0
  );

  if (hasAnySyncEnabled) {
    document.body.classList.add(VIBES_SYNC_ENABLED_CLASS);
  } else {
    document.body.classList.remove(VIBES_SYNC_ENABLED_CLASS);
  }
}

const sthis = Lazy(() => ensureSuperThis());

export { fireproof, ImgFile };

// Re-export all types under a namespace
export type * as Fireproof from 'use-fireproof';

// Helper to check if JWT token is expired
export async function isJWTExpired(token: string): Promise<boolean> {
  try {
    const kb = await getKeyBag(sthis());
    await kb.setJwt('vibes-temp-check', token);
    const result = await kb.getJwt('vibes-temp-check');

    if (result.isErr()) return true;

    const claims = result.Ok().claims;
    if (!claims?.exp || typeof claims.exp !== 'number') return true;
    // Buffer of 60 seconds
    return Date.now() >= claims.exp * 1000 - 60000;
  } catch {
    return true;
  }
}

// Helper function to create toCloud configuration
export function toCloud(opts?: UseFpToCloudParam): ToCloudAttachable {
  const attachable = originalToCloud({
    ...opts,
    dashboardURI: 'https://connect.fireproof.direct/fp/cloud/api/token-auto',
    tokenApiURI: 'https://connect.fireproof.direct/api',
    urls: { base: 'fpcloud://cloud.fireproof.direct' },
  });

  return attachable;
}

// Helper function to construct database name with vibe metadata
function constructDatabaseName(
  nameOrDatabase?: string | Database,
  vibeMetadata?: VibeMetadata
): string | Database {
  // If it's already a Database object, return it directly
  if (typeof nameOrDatabase === 'object' && nameOrDatabase !== null) {
    return nameOrDatabase;
  }

  // Determine the base name. If nameOrDatabase is undefined or an empty string, use 'default'.
  const baseName: string = (nameOrDatabase as string | undefined) || 'default';

  // If no vibeMetadata, return the baseName as is
  if (!vibeMetadata) {
    return baseName;
  }

  // Otherwise, augment the baseName with vibeMetadata
  return `vf-${baseName}-${vibeMetadata.titleId}-${vibeMetadata.installId}`;
}

// Custom useFireproof hook with implicit cloud sync and button integration
export function useFireproof(nameOrDatabase?: string | Database) {
  // Read vibe context if available (for inline rendering with proper ledger naming)
  const vibeMetadata = useVibeContext();

  // Construct augmented database name with vibe metadata (titleId + installId)
  const augmentedDbName = constructDatabaseName(nameOrDatabase, vibeMetadata);

  // Generate unique instance ID for this hook instance (no React dependency)
  const instanceId = `instance-${++instanceCounter}`;

  // Get database name for tracking purposes (use augmented name)
  const dbName =
    typeof augmentedDbName === 'string' ? augmentedDbName : augmentedDbName?.name || 'default';
  // Use global sync key - all databases share the same auth token and sync state
  const syncKey = 'fireproof-sync-enabled';

  // Check if sync was previously enabled (persists across refreshes)
  const wasSyncEnabled = typeof window !== 'undefined' && localStorage.getItem(syncKey) === 'true';

  // Create attach config only if sync was previously enabled, passing vibeMetadata
  const attachConfig = wasSyncEnabled ? toCloud() : undefined;

  // Use original useFireproof with augmented database name
  // This ensures each titleId + installId combination gets its own database
  const result = originalUseFireproof(
    augmentedDbName,
    attachConfig ? { attach: attachConfig } : {}
  );

  // State to track manual attachment for first-time enable
  // Captures vibeMetadata at enableSync time to avoid race conditions
  const [manualAttach, setManualAttach] = useState<{
    state: 'pending' | 'attached' | 'error';
    vibeMetadata?: VibeMetadata;
    attached?: Attached;
    error?: Error;
  } | null>(null);

  // Handle first-time sync enable without reload
  useEffect(() => {
    if (manualAttach?.state === 'pending' && result.database) {
      const cloudConfig = toCloud();
      result.database
        .attach(cloudConfig)
        .then((attached) => {
          setManualAttach({ state: 'attached', vibeMetadata: manualAttach.vibeMetadata, attached });
          // Save preference for next refresh
          localStorage.setItem(syncKey, 'true');
        })
        .catch((error) => {
          setManualAttach({ state: 'error', vibeMetadata: manualAttach.vibeMetadata, error });
          // Emit a low-noise diagnostic event for observers
          try {
            document.dispatchEvent(
              new CustomEvent(VIBES_SYNC_ERROR_EVENT, { detail: { error, phase: 'attach' } })
            );
          } catch {
            // Ignore when not in a DOM environment
          }
        });

      // Wait for overlay ready event, then programmatically click the auth link
      let eventReceived = false;

      const handleOverlayReady = () => {
        eventReceived = true;
        clearTimeout(timeoutId);

        // Wait a tiny bit for DOM to be fully interactive
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
        }, 100);
      };

      // Set up event listener
      document.addEventListener('vibes-auth-overlay-ready', handleOverlayReady, { once: true });

      // Safety timeout in case event never fires (5 seconds)
      const timeoutId = setTimeout(() => {
        if (!eventReceived) {
          document.removeEventListener('vibes-auth-overlay-ready', handleOverlayReady);
        }
      }, 5000);

      // Cleanup
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('vibes-auth-overlay-ready', handleOverlayReady);
      };
    }
  }, [manualAttach, result.database, syncKey, dbName]);

  // Function to enable sync and trigger popup directly
  const enableSync = useCallback(() => {
    if (!wasSyncEnabled && !manualAttach) {
      // First time enabling - manual attach
      // Capture vibeMetadata at this moment to avoid race conditions
      setManualAttach({ state: 'pending', vibeMetadata });
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
  }, [wasSyncEnabled, manualAttach, vibeMetadata]);

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
    manualAttach?.state === 'attached';

  // Share function that immediately adds a user to the ledger by email
  const share = useCallback(
    async (options: {
      email: string;
      role?: 'admin' | 'member';
      right?: 'read' | 'write';
      token?: string;
    }) => {
      const token = options.token;

      if (!token) {
        throw new Error('Authentication token required for sharing.');
      }

      // Create auth object matching AuthType interface: { type: "clerk", token: string }
      const auth = {
        type: 'clerk' as const,
        token,
      };

      // Call the dashboard API (same pattern as other Fireproof dashboard requests)
      // Uses PUT method with auth in body, not headers
      const apiUrl = 'https://connect.fireproof.direct/api'; // Replace with your actual API URL

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          type: 'reqShareWithUser',
          auth: auth,
          email: options.email,
          role: options.role || 'member',
          right: options.right || 'read',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Share failed: HTTP ${response.status} ${response.statusText}: ${errorText}`
        );
      }

      const shareData = (await response.json()) as ShareApiResponse;

      // Return share result
      return {
        success: shareData.success,
        email: shareData.email,
        role: shareData.role,
        right: shareData.right,
        message: shareData.message || 'User added to ledger successfully',
      };
    },
    [dbName, result.attach, manualAttach]
  );

  // Listen for custom 'vibes-share-request' events on document
  // Any element can dispatch this event to trigger share
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleShareRequest = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        email: string;
        role?: 'admin' | 'member';
        right?: 'read' | 'write';
        token?: string;
      }>;

      const { email, role = 'member', right = 'read', token } = customEvent.detail || {};

      if (!email) {
        const error = new Error('vibes-share-request requires email in event detail');
        document.dispatchEvent(
          new CustomEvent('vibes-share-error', {
            detail: { error, originalEvent: event },
            bubbles: true,
          })
        );
        return;
      }

      if (!token) {
        const error = new Error('vibes-share-request requires token in event detail');
        document.dispatchEvent(
          new CustomEvent('vibes-share-error', {
            detail: { error, originalEvent: event },
            bubbles: true,
          })
        );
        return;
      }

      try {
        const result = await share({ email, role, right, token });

        // Dispatch success event
        document.dispatchEvent(
          new CustomEvent('vibes-share-success', {
            detail: { ...result, originalEvent: event },
            bubbles: true,
          })
        );
      } catch (error) {
        // Dispatch error event
        document.dispatchEvent(
          new CustomEvent('vibes-share-error', {
            detail: { error, originalEvent: event },
            bubbles: true,
          })
        );
      }
    };

    document.addEventListener('vibes-share-request', handleShareRequest);

    return () => {
      document.removeEventListener('vibes-share-request', handleShareRequest);
    };
  }, [share]);

  // Listen for custom 'vibes-sync-enable' event on document
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncEnable = () => {
      enableSync();
    };

    document.addEventListener(VIBES_SYNC_ENABLE_EVENT, handleSyncEnable);

    return () => {
      document.removeEventListener(VIBES_SYNC_ENABLE_EVENT, handleSyncEnable);
    };
  }, [enableSync]);

  // Listen for custom 'vibes-sync-disable' event on document
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncDisable = () => {
      disableSync();
    };

    document.addEventListener(VIBES_SYNC_DISABLE_EVENT, handleSyncDisable);

    return () => {
      document.removeEventListener(VIBES_SYNC_DISABLE_EVENT, handleSyncDisable);
    };
  }, [disableSync]);

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
    share,
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
export { VibesButton } from './components/VibesButton/VibesButton.js';
export { VibesSwitch } from './components/VibesSwitch/VibesSwitch.js';

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
export type { UseVibesOptions, UseVibesResult, VibeDocument } from '@vibes.diy/use-vibes-types';
export { useVibes } from './hooks/vibes-gen/index.js';

// Export components for React users
export { VibeControl } from './components/VibeControl.js';
export type { VibeControlProps } from './components/VibeControl.js';

// Export HiddenMenuWrapper component and utilities
export { HiddenMenuWrapper } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
export type { HiddenMenuWrapperProps } from './components/HiddenMenuWrapper/HiddenMenuWrapper.js';
export { hiddenMenuTheme } from './components/HiddenMenuWrapper/HiddenMenuWrapper.styles.js';
export {
  createVibeControlStyles,
  defaultVibeControlClasses,
  vibeControlTheme,
} from './utils/vibe-control-styles.js';
export type { VibeControlClasses } from './utils/vibe-control-styles.js';
// Export additional components
export { VibesPanel } from './components/VibesPanel/VibesPanel.js';
export type { VibesPanelProps } from './components/VibesPanel/VibesPanel.js';
export { BrutalistCard } from './components/BrutalistCard/index.js';
export type {
  BrutalistCardProps,
  BrutalistCardVariant,
  BrutalistCardSize,
} from './components/BrutalistCard/index.js';

// Export unified mount function - the main API for non-React environments
export { mountVibesApp } from './vibe-app-mount.js';
export type { MountVibesAppOptions, MountVibesAppResult } from './vibe-app-mount.js';

// Export app slug utilities
export {
  getAppSlug,
  getInstanceId,
  getFullAppIdentifier,
  isDevelopmentEnvironment,
  isProductionEnvironment,
  generateRandomInstanceId,
  generateFreshDataUrl,
  generateRemixUrl,
  generateInstallId,
} from './utils/appSlug.js';

// Export VibeContext for inline rendering with proper ledger naming
export {
  VibeContextProvider,
  useVibeContext,
  VibeMetadataValidationError,
  VIBE_METADATA_ERROR_CODES,
} from './contexts/VibeContext.js';
export type { VibeMetadata } from './contexts/VibeContext.js';

// Export mounting utilities for inline vibe rendering
export {
  mountVibeCode,
  mountVibeWithCleanup,
  isVibesMountReadyEvent,
  isVibesMountErrorEvent,
} from './mounting/index.js';
export type { VibesMountReadyDetail, VibesMountErrorDetail } from './mounting/index.js';
