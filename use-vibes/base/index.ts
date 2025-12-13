import type { ToCloudAttachable, TokenAndClaims } from '@fireproof/core-types-protocols-cloud';
import { getKeyBag } from '@fireproof/core-keybag';
import { Lazy, Result } from '@adviser/cement';
import { ensureSuperThis } from '@fireproof/core-runtime';
import { useCallback, useEffect } from 'react';
import { decodeJwt, type JWTPayload } from 'jose';
import {
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  type Database,
  type UseFpToCloudParam,
} from '@fireproof/use-fireproof';
import { DashboardApiImpl } from '@fireproof/core-protocols-dashboard';
import type { DashAuthType } from '@fireproof/core-protocols-dashboard';
import { VIBES_SYNC_ENABLED_CLASS } from './constants.js';
import { useVibeContext, type VibeMetadata } from './contexts/VibeContext.js';
import { constructVibesDatabaseName } from './utils/databaseName.js';

// Cloud connection URLs - same as used by vibes.diy app via DashboardContext
const DASHBOARD_API_URL = 'https://connect.fireproof.direct/api';
const DASHBOARD_URI = 'https://connect.fireproof.direct/fp/cloud/api/token-auto';
const CLOUD_BASE_URL = 'fpcloud://cloud.fireproof.direct';

// Declare Clerk on window for dynamic import
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (opts?: { template?: string }) => Promise<string | null>;
      };
      user?: unknown;
      addListener?: (
        callback: (resources: {
          session?: { getToken: (opts?: { template?: string }) => Promise<string | null> };
        }) => void
      ) => () => void;
    };
  }
}

// Clerk instance promise (singleton per publishable key)
const clerkPromises = new Map<string, Promise<typeof window.Clerk>>();

/**
 * Get or initialize Clerk instance.
 * Uses dynamic import to load Clerk JS SDK.
 * @param clerkPublishableKey - The Clerk publishable key to use for initialization
 */
async function getClerk(clerkPublishableKey: string): Promise<typeof window.Clerk> {
  if (typeof window === 'undefined') {
    return undefined;
  }

  // If Clerk is already loaded on window, use it
  if (window.Clerk) {
    return window.Clerk;
  }

  // Otherwise, dynamically import and initialize
  if (!clerkPromises.has(clerkPublishableKey)) {
    const promise = (async () => {
      try {
        // Dynamic import - clerk-js is available via import map in serve context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ClerkModule = await import('@clerk/clerk-js' as any);
        const Clerk = ClerkModule.Clerk || ClerkModule.default;

        const clerk = new Clerk(clerkPublishableKey);
        await clerk.load();

        return clerk as unknown as typeof window.Clerk;
      } catch {
        return undefined;
      }
    })();
    clerkPromises.set(clerkPublishableKey, promise);
  }

  // We just set it above, so we know it exists
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return clerkPromises.get(clerkPublishableKey)!;
}

// Singleton DashboardApiImpl instances keyed by clerkPublishableKey
const dashApiInstances = new Map<string, DashboardApiImpl<unknown>>();

/**
 * Get or create a DashboardApiImpl instance for the given Clerk publishable key.
 * Creates the dashApi with a token getter that uses the dynamically loaded Clerk instance.
 */
function getDashApi(clerkPublishableKey: string): DashboardApiImpl<unknown> {
  let dashApi = dashApiInstances.get(clerkPublishableKey);
  if (!dashApi) {
    dashApi = new DashboardApiImpl({
      apiUrl: DASHBOARD_API_URL,
      gracePeriodMs: 5000,
      fetch: fetch.bind(globalThis),
      getToken: async (): Promise<Result<DashAuthType>> => {
        const clerk = await getClerk(clerkPublishableKey);
        if (!clerk?.session) {
          return Result.Err(new Error('No Clerk session available'));
        }
        try {
          const token = await clerk.session.getToken({ template: 'with-email' });
          if (!token) {
            return Result.Err(new Error('No token from Clerk session'));
          }
          return Result.Ok({ type: 'clerk', token });
        } catch (error) {
          return Result.Err(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });
    dashApiInstances.set(clerkPublishableKey, dashApi);
  }
  return dashApi;
}

// Cache for cloud tokens by appId
const cloudTokenCache = new Map<string, { token: TokenAndClaims; expiresAt: number }>();

/**
 * Create a token getter function for Clerk that exchanges the Clerk JWT
 * for a Fireproof cloud token via the ensureCloudToken API.
 *
 * @param clerkPublishableKey - The Clerk publishable key to use for initialization
 * @param appId - The app identifier (typically the database name)
 */
function createClerkTokenGetter(
  clerkPublishableKey: string,
  appId: string
): () => Promise<TokenAndClaims | undefined> {
  return async () => {
    // Check cache first
    const cached = cloudTokenCache.get(appId);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      // Use cached token if not expiring within 60 seconds
      return cached.token;
    }

    // Get Clerk instance to verify we have a session
    const clerk = await getClerk(clerkPublishableKey);
    if (!clerk?.session) {
      return undefined;
    }

    try {
      // Get DashboardApiImpl for this Clerk key
      const dashApi = getDashApi(clerkPublishableKey);

      // First ensure the user exists in Fireproof (creates user if needed)
      const ensureUserResult = await dashApi.ensureUser({});
      if (ensureUserResult.isErr()) {
        return undefined;
      }

      // Exchange Clerk JWT for Fireproof cloud token
      const tokenResult = await dashApi.ensureCloudToken({ appId, env: 'prod' });
      if (tokenResult.isErr()) {
        return undefined;
      }

      const result = tokenResult.Ok();

      // Decode claims from cloud token
      const claims = decodeJwt(result.cloudToken) as JWTPayload;
      const tokenAndClaims: TokenAndClaims = {
        token: result.cloudToken,
        claims: claims as TokenAndClaims['claims'],
      };

      // Cache the token
      cloudTokenCache.set(appId, {
        token: tokenAndClaims,
        expiresAt: Date.now() + result.expiresInSec * 1000,
      });

      return tokenAndClaims;
    } catch {
      return undefined;
    }
  };
}

// Track sync status by database name and instance ID
const syncEnabledInstances = new Map<string, Set<string>>();

// Simple counter for generating unique instance IDs (avoids React.useId conflicts)
let instanceCounter = 0;

// Track all database names used in this page load (for invite functionality)
const usedDatabaseNames = new Set<string>();

// Expose first database name globally for vibe-controls to access
if (typeof window !== 'undefined') {
  interface WindowWithVibeDB extends Window {
    __VIBE_DB__?: {
      get: () => string;
    };
  }
  (window as WindowWithVibeDB).__VIBE_DB__ = {
    get: () => Array.from(usedDatabaseNames)[0] || 'default',
  };
}

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

// Extended options for toCloud with Clerk token support
interface ToCloudWithClerkOpts extends UseFpToCloudParam {
  clerkPublishableKey?: string;
  appId?: string; // App identifier for ensureCloudToken (typically the database name)
}

// Helper function to create toCloud configuration
export function toCloud(opts?: ToCloudWithClerkOpts): ToCloudAttachable {
  const { clerkPublishableKey, appId, ...restOpts } = opts || {};

  console.log('[toCloud] Creating cloud config with opts:', {
    hasClerkKey: !!clerkPublishableKey,
    appId,
    dashboardURI: DASHBOARD_URI,
    tokenApiURI: DASHBOARD_API_URL,
  });

  // If using Clerk token, create a token getter that exchanges for Fireproof cloud token
  const tokenOpts =
    clerkPublishableKey && appId
      ? {
          token: createClerkTokenGetter(clerkPublishableKey, appId),
        }
      : {};

  const attachable = originalToCloud({
    ...restOpts,
    ...tokenOpts,
    dashboardURI: DASHBOARD_URI,
    tokenApiURI: DASHBOARD_API_URL,
    urls: { base: CLOUD_BASE_URL },
  });

  console.log('[toCloud] Created attachable:', {
    hasToken: !!attachable.token,
    hasClerkKey: !!clerkPublishableKey,
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
  return constructVibesDatabaseName(vibeMetadata.titleId, vibeMetadata.installId, baseName);
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

  // Track this database name for global access
  if (typeof nameOrDatabase === 'string') {
    usedDatabaseNames.add(nameOrDatabase);
  }

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
          hasClerkKey: !!vibeMetadata.clerkPublishableKey,
        }
      : null,
  });

  // Create attach config if sync should be enabled
  // User vibes use Clerk token that is exchanged for Fireproof cloud token via ensureCloudToken API
  const attachConfig = shouldSync
    ? toCloud({
        clerkPublishableKey: vibeMetadata?.clerkPublishableKey,
        appId: dbName, // Use database name as app identifier for ensureCloudToken
      })
    : undefined;

  if (attachConfig) {
    console.log('[useFireproof] Created attachConfig for sync:', {
      hasClerkKey: !!vibeMetadata?.clerkPublishableKey,
      appId: dbName,
    });
  }

  // Use original useFireproof with augmented database name
  // This ensures each titleId + installId combination gets its own database
  const result = originalUseFireproof(
    augmentedDbName,
    attachConfig ? { attach: attachConfig } : {}
  );

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
  const share = useCallback(
    async (options: { email: string; role?: 'admin' | 'member'; right?: 'read' | 'write' }) => {
      const clerkPublishableKey = vibeMetadata?.clerkPublishableKey;
      if (!clerkPublishableKey) {
        throw new Error('Clerk publishable key required for sharing (vibeMetadata not available).');
      }

      // Get dashApi instance for this Clerk key
      const dashApi = getDashApi(clerkPublishableKey);

      // Get ledger info from ensureCloudToken
      const tokenResult = await dashApi.ensureCloudToken({ appId: dbName });
      if (tokenResult.isErr()) {
        const error = tokenResult.Err();
        throw new Error(`Failed to get cloud token: ${error.message || error}`);
      }

      const tokenData = tokenResult.Ok();
      const ledgerId = tokenData.ledger;

      // Invite user to ledger using dashApi
      const inviteResult = await dashApi.inviteUser({
        ticket: {
          query: { byEmail: options.email },
          invitedParams: {
            ledger: {
              id: ledgerId,
              role: options.role || 'member',
              right: options.right || 'read',
            },
          },
        },
      });

      if (inviteResult.isErr()) {
        const error = inviteResult.Err();
        throw new Error(`Share failed: ${error.message || error}`);
      }

      // Return share result
      return {
        success: true,
        email: options.email,
        role: options.role || 'member',
        right: options.right || 'read',
        message: 'User added to ledger successfully',
      };
    },
    [dbName, vibeMetadata?.clerkPublishableKey]
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
      }>;

      const { email, role = 'member', right = 'read' } = customEvent.detail || {};

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

      try {
        const result = await share({ email, role, right });

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
