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
  RedirectStrategy,
  type Database,
  type UseFpToCloudParam,
} from 'use-fireproof';
import { VIBES_SYNC_ENABLED_CLASS, VIBES_SYNC_ERROR_EVENT } from './constants.js';
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

// Storage key for authentication token sync
const VIBES_AUTH_TOKEN_KEY = 'vibes-diy-auth-token' as const;

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

/**
 * VibesAuthStrategy
 *
 * This strategy is a "hack" to bridge the authentication state from the host application (vibes.diy)
 * into the use-vibes library's Fireproof instance.
 *
 * The host app stores the JWT in localStorage under 'vibes-diy-auth-token'.
 * We need to inject this token into Fireproof's internal state so it can connect to the cloud
 * without triggering a new authentication flow (popup).
 *
 * We extend RedirectStrategy and manually set the protected `currentToken` property.
 * This avoids the need for the complex ManualRedirectStrategy that was previously used.
 */
// Minimal strategy to inject external auth token
class VibesAuthStrategy extends RedirectStrategy {
  setToken(token: string): void {
    // Use KeyBag to decode and validate JWT asynchronously
    // Fire-and-forget pattern since setToken is synchronous
    getKeyBag(sthis()).then(async (kb: Awaited<ReturnType<typeof getKeyBag>>) => {
      await kb.setJwt('vibes-auth-token', token);
      const result = await kb.getJwt('vibes-auth-token');

      const claims = result.isOk() ? result.Ok().claims : undefined;

      // Inject token into parent class state
      // @ts-expect-error - accessing protected/private property to bridge auth
      this.currentToken = {
        token,
        claims,
      };
    });

    // Temporary synchronous fallback for immediate access
    // @ts-expect-error - accessing protected/private property to bridge auth
    this.currentToken = {
      token,
      claims: {}, // Will be populated async
    };
  }
}

// Helper function to create toCloud configuration
export function toCloud(opts?: UseFpToCloudParam): ToCloudAttachable {
  const strategy = new VibesAuthStrategy();

  // Check if an external token exists in localStorage and inject it
  if (typeof window !== 'undefined') {
    try {
      const externalToken = localStorage.getItem(VIBES_AUTH_TOKEN_KEY);
      if (externalToken) {
        // Set token immediately (synchronously) so it's available when ToCloud is created
        strategy.setToken(externalToken);

        // Check expiration asynchronously and clean up if expired
        isJWTExpired(externalToken).then((expired) => {
          if (expired) {
            console.log('[toCloud] Token expired, removing from localStorage');
            localStorage.removeItem(VIBES_AUTH_TOKEN_KEY);
            // Note: The attach may have already started with this token,
            // but it will fail auth and trigger the popup flow
          }
        });
      } else {
        console.log('[toCloud] No token found in localStorage, will trigger auth flow');
      }
    } catch (e) {
      console.log('[toCloud] Error reading token from localStorage:', e);
      // Ignore storage errors
    }
  }

  console.log('[toCloud] VibesAuthStrategy', opts, strategy);

  const attachable = originalToCloud({
    ...opts,
    strategy,
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
  // Read vibe context if available (for inline rendering with proper ledger naming and sync control)
  const vibeContext = useVibeContext();
  const vibeMetadata = vibeContext?.metadata;
  const shouldEnableSync = vibeContext?.syncEnabled ?? false;

  // Construct augmented database name with vibe metadata (titleId + installId)
  const augmentedDbName = constructDatabaseName(nameOrDatabase, vibeMetadata);

  // Generate unique instance ID for this hook instance (no React dependency)
  const instanceId = `instance-${++instanceCounter}`;

  // Get database name for tracking purposes (use augmented name)
  const dbName =
    typeof augmentedDbName === 'string' ? augmentedDbName : augmentedDbName?.name || 'default';

  // Create attach config if context says sync should be enabled
  const attachConfig = shouldEnableSync ? toCloud() : undefined;

  // Use original useFireproof with augmented database name
  // This ensures each titleId + installId combination gets its own database

  console.log('[useFireproof] augmentedDbName:', augmentedDbName, 'attachConfig:', attachConfig);

  const result = originalUseFireproof(
    augmentedDbName,
    attachConfig ? { attach: attachConfig } : {}
  );

  // Determine sync status based on context and attachment state
  const syncEnabled =
    shouldEnableSync &&
    (result.attach?.state === 'attached' || result.attach?.state === 'attaching');

  // Bridge Fireproof authentication to call-ai by syncing tokens to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get the attach context
    const attach = result.attach;

    // Check if we have a ready token state
    const hasReadyToken =
      attach &&
      typeof attach === 'object' &&
      'ctx' in attach &&
      attach.ctx?.tokenAndClaims?.state === 'ready';

    if (hasReadyToken && attach.ctx?.tokenAndClaims) {
      // Extract the token from the ready state
      const readyState = attach.ctx.tokenAndClaims;
      const tokenData = readyState.tokenAndClaims;

      if (tokenData?.token) {
        try {
          // Store the token for call-ai integration
          localStorage.setItem(VIBES_AUTH_TOKEN_KEY, tokenData.token);
        } catch (error) {
          // Emit a diagnostic event instead of noisy console logs
          try {
            document.dispatchEvent(
              new CustomEvent(VIBES_SYNC_ERROR_EVENT, {
                detail: { error, phase: 'token-sync' },
              })
            );
          } catch {
            // Ignore when not in a DOM environment
          }
        }
      }
    }
  }, [result.attach, syncEnabled]);

  // Share function that immediately adds a user to the ledger by email
  const share = useCallback(
    async (options: { email: string; role?: 'admin' | 'member'; right?: 'read' | 'write' }) => {
      // Get token directly from localStorage (vibes.diy auth)
      const token =
        typeof window !== 'undefined' ? localStorage.getItem(VIBES_AUTH_TOKEN_KEY) : null;

      if (!token) {
        throw new Error('Unable to retrieve authentication token.');
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
    [dbName, result.attach]
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

  // Return combined result with sync status and share function
  return {
    ...result,
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
