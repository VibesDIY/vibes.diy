import type { ToCloudAttachable, TokenStrategie } from '@fireproof/core-types-protocols-cloud';
import { useCallback, useEffect } from 'react';
import {
  fireproof,
  ImgFile,
  isDatabase,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  type Database,
  type UseFpToCloudParam,
} from '@fireproof/use-fireproof';
import { MountVibeParams, useVibeContext } from './contexts/VibeContext.js';
import { constructVibesDatabaseName } from './utils/databaseName.js';
import { callAI } from 'call-ai';
import z from 'zod';

// Cloud connection URLs - same as used by vibes.diy app via DashboardContext
// const DASHBOARD_API_URL = 'https://connect.fireproof.direct/api';
// const DASHBOARD_URI = 'https://connect.fireproof.direct/fp/cloud/api/token-auto';
// const CLOUD_BASE_URL = 'fpcloud://cloud.fireproof.direct';

// Track sync status by database name and instance ID
const syncEnabledInstances = new Map<string, Set<string>>();

// Simple counter for generating unique instance IDs (avoids React.useId conflicts)
let instanceCounter = 0;

export { fireproof, ImgFile };

// Re-export all types under a namespace
export type * as Fireproof from '@fireproof/use-fireproof';


export const VibesEnvSchema = z.object({
  FPCLOUD_URL: z.string(),
  DASHBOARD_URL: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string()
});

export type VibesEnv = z.infer<typeof VibesEnvSchema>;


// Extended options for toCloud with Clerk token support
interface ToCloudWithClerkOpts extends UseFpToCloudParam {
  readonly env: VibesEnv
}

export interface VibesCtx {
  readonly env: VibesEnv;
  strategy: TokenStrategie
  onDatabaseOpen(database: Database): void; 
}

let injectedVibesCtx: VibesCtx | undefined = undefined;

function defVibesCtx(): VibesCtx {
  if (!injectedVibesCtx) {
    throw new Error('VibesCtx not injected. Please call injectDefaultVibes');
  }
  return injectedVibesCtx;
}

export function injectDefaultVibesCtx(ctx: VibesCtx) {
  injectedVibesCtx = ctx;
}


// Helper function to create toCloud configuration
export function toCloud(iopts?: ToCloudWithClerkOpts): ToCloudAttachable {
  const defCtx = defVibesCtx();
  const opts = {
    ...defCtx.env,
    ...iopts,
  }
  console.log('[toCloud] Creating cloud config with opts:', opts);

  const attachable = originalToCloud({
    // ...restOpts,
    // ...tokenOpts,
    strategy: opts.strategy, 
    dashboardURI: defCtx.env.DASHBOARD_URL,
    urls: { base: defCtx.env.FPCLOUD_URL },
  });
  return attachable;
}

// Helper function to construct database name with vibe metadata
function constructDatabaseName(
  nameOrDatabase: string | Database,
  mountParams: MountVibeParams
): string | Database {
  if (isDatabase(nameOrDatabase)) {
    return nameOrDatabase;
  }

  // Determine the base name. If nameOrDatabase is undefined or an empty string, use 'default'.
  const baseName: string = (nameOrDatabase as string | undefined) || 'default';

  // // If no vibeMetadata, return the baseName as is
  // if (!mountParams) {
  //   return baseName;
  // }

  // Otherwise, augment the baseName with vibeMetadata
  return constructVibesDatabaseName(mountParams.titleId, mountParams.installId, baseName);
}

// Custom useFireproof hook with implicit cloud sync and button integration
export function useFireproof(nameOrDatabase?: string | Database) {

  // Read vibe context if available (for inline rendering with proper ledger naming)
  const vibeMetadata = useVibeContext();

  if (!nameOrDatabase) {
    nameOrDatabase = vibeMetadata.appSlug;
  }

  // Construct augmented database name with vibe metadata (titleId + installId)
  const augmentedDbName = constructDatabaseName(nameOrDatabase, vibeMetadata);

  // Generate unique instance ID for this hook instance (no React dependency)
  const instanceId = `instance-${++instanceCounter}`;

  // Get database name for tracking purposes (use augmented name)
  const dbName =
    typeof augmentedDbName === 'string' ? augmentedDbName : augmentedDbName?.name || 'default';

  // // Track this database name for global access
  // if (typeof nameOrDatabase === 'string') {
  //   usedDatabaseNames.add(nameOrDatabase);
  // }

  // Use global sync key - all databases share the same auth token and sync state
  const syncKey = 'fireproof-sync-enabled';

  // Check if sync was previously enabled (persists across refreshes)
  const wasSyncEnabled = typeof window !== 'undefined' && localStorage.getItem(syncKey) === 'true';

  // User vibes (with vibeMetadata from VibeContextProvider) always sync automatically.
  // The vibes.diy app itself uses localStorage opt-in for its databases.
  const isUserVibe = vibeMetadata !== undefined;
  const shouldSync = isUserVibe || wasSyncEnabled;

  // Log sync decision for debugging
  console.log('[useFireproof] Sync decision:', {
    isUserVibe,
    wasSyncEnabled,
    shouldSync,
    dbName,
    vibeMetadata: vibeMetadata
      ? {
          titleId: vibeMetadata.titleId,
          installId: vibeMetadata.installId,
        }
      : null,
  });

  // Create attach config if sync should be enabled
  // User vibes use Clerk token that is exchanged for Fireproof cloud token via ensureCloudToken API
  const attachConfig = shouldSync ? toCloud() : undefined;

  if (attachConfig) {
    console.log('[useFireproof] Created attachConfig for sync:', {
      appId: dbName,
    });
  }

  // Use original useFireproof with augmented database name
  // This ensures each titleId + installId combination gets its own database
  const result = originalUseFireproof(
    augmentedDbName,
    attachConfig ? { attach: attachConfig } : {}
  );

  result.database.ledger.ctx.set("vibesAppId", augmentedDbName);

  // Log attachment state for debugging
  console.log('[useFireproof] Result attach state:', {
    attachState: result.attach?.state,
    hasAttach: !!result.attach,
    dbName,
  });

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
    shouldSync && (result.attach?.state === 'attached' || result.attach?.state === 'attaching');

  // Share function that immediately adds a user to the ledger by email
  // const share = useCallback(
  //   async (options: { email: string; role?: 'admin' | 'member'; right?: 'read' | 'write' }) => {
  //     // Get dashApi instance for this Clerk key
  //     const dashApi = clerkDashApi()
  //     getDashApi(clerkPublishableKey);

  //     // Get ledger info from ensureCloudToken
  //     const tokenResult = await dashApi.ensureCloudToken({ appId: dbName });
  //     if (tokenResult.isErr()) {
  //       const error = tokenResult.Err();
  //       throw new Error(`Failed to get cloud token: ${error.message || error}`);
  //     }

  //     const tokenData = tokenResult.Ok();
  //     const ledgerId = tokenData.ledger;

  //     // Invite user to ledger using dashApi
  //     const inviteResult = await dashApi.inviteUser({
  //       ticket: {
  //         query: { byEmail: options.email },
  //         invitedParams: {
  //           ledger: {
  //             id: ledgerId,
  //             role: options.role || 'member',
  //             right: options.right || 'read',
  //           },
  //         },
  //       },
  //     });

  //     if (inviteResult.isErr()) {
  //       const error = inviteResult.Err();
  //       throw new Error(`Share failed: ${error.message || error}`);
  //     }

  //     // Return share result
  //     return {
  //       success: true,
  //       email: options.email,
  //       role: options.role || 'member',
  //       right: options.right || 'read',
  //       message: 'User added to ledger successfully',
  //     };
  //   },
  //   [dbName, vibeMetadata?.clerkPublishableKey]
  // );

  // Listen for custom 'vibes-share-request' events on document
  // Any element can dispatch this event to trigger share
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;

  //   const handleShareRequest = async (event: Event) => {
  //     const customEvent = event as CustomEvent<{
  //       email: string;
  //       role?: 'admin' | 'member';
  //       right?: 'read' | 'write';
  //     }>;

  //     const { email, role = 'member', right = 'read' } = customEvent.detail || {};

  //     if (!email) {
  //       const error = new Error('vibes-share-request requires email in event detail');
  //       document.dispatchEvent(
  //         new CustomEvent('vibes-share-error', {
  //           detail: { error, originalEvent: event },
  //           bubbles: true,
  //         })
  //       );
  //       return;
  //     }

  //     try {
  //       const result = await share({ email, role, right });

  //       // Dispatch success event
  //       document.dispatchEvent(
  //         new CustomEvent('vibes-share-success', {
  //           detail: { ...result, originalEvent: event },
  //           bubbles: true,
  //         })
  //       );
  //     } catch (error) {
  //       // Dispatch error event
  //       document.dispatchEvent(
  //         new CustomEvent('vibes-share-error', {
  //           detail: { error, originalEvent: event },
  //           bubbles: true,
  //         })
  //       );
  //     }
  //   };

  //   document.addEventListener('vibes-share-request', handleShareRequest);

  //   return () => {
  //     document.removeEventListener('vibes-share-request', handleShareRequest);
  //   };
  // }, [share]);

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
    // updateBodyClass();

    // Cleanup on unmount - remove this instance
    return () => {
      const currentInstanceSet = syncEnabledInstances.get(dbName);
      if (currentInstanceSet) {
        currentInstanceSet.delete(instanceId);
        // Clean up empty sets
        if (currentInstanceSet.size === 0) {
          syncEnabledInstances.delete(dbName);
        }
        // updateBodyClass();
      }
    };
  }, [syncEnabled, dbName, instanceId]);

  // Return combined result with stub sync functions
  return {
    ...result,
    enableSync,
    disableSync,
    syncEnabled,
    // share,
  };
}

// Re-export specific functions and types from call-ai

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
export { constructVibesDatabaseName } from './utils/databaseName.js';

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
