import type { ToCloudAttachable } from '@fireproof/core-types-protocols-cloud';
import { getKeyBag } from '@fireproof/core-keybag';
import { Lazy } from '@adviser/cement';
import { ensureSuperThis } from '@fireproof/core-runtime';
import { useCallback, useEffect } from 'react';
import {
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  type Database,
  type UseFpToCloudParam,
} from '@fireproof/use-fireproof';
import { VIBES_SYNC_ENABLED_CLASS } from './constants.js';
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
export type * as Fireproof from '@fireproof/use-fireproof';

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

  // TODO: Enable sync with Clerk token
  const enableSync = useCallback(() => {
    console.log('enableSync() not implemented - TODO: Enable sync with Clerk token');
  }, []);

  // TODO: Disable sync with Clerk token
  const disableSync = useCallback(() => {
    console.log('disableSync() not implemented - TODO: Disable sync with Clerk token');
  }, []);

  // Determine sync status - check for actual attachment state
  const syncEnabled =
    wasSyncEnabled && (result.attach?.state === 'attached' || result.attach?.state === 'attaching');

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
          // todo, after fireproof dashboard API imported, use that instead of raw fetch
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
    [dbName, result.attach]
  );

  // Listen for custom 'vibes-share-request' events on document
  // Any element can dispatch this event to trigger share
  // does this event chaining make sense? identify callers and listeners, are there othere other dispatchers?
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

  // Return combined result with stub sync functions
  return {
    ...result,
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

// Export hooks
export { hashInput, useImageGen } from './hooks/image-gen/index.js';
export { useThemeDetection } from './hooks/useThemeDetection.js';
export { useMobile } from './hooks/useMobile.js';

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

// App-specific components moved to vibes.diy/pkg/app - no longer exported

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

// Export VibeContext for inline rendering with proper ledger naming (needed by useFireproof)
export {
  VibeContextProvider,
  useVibeContext,
  VibeMetadataValidationError,
  VIBE_METADATA_ERROR_CODES,
  validateVibeMetadata,
} from './contexts/VibeContext.js';
export type { VibeMetadata } from './contexts/VibeContext.js';

// Mounting utilities moved to vibes.diy/pkg/app - no longer exported
