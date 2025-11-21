/**
 * Universal app slug extraction utility
 *
 * Handles URL format: http://vibes.diy/vibe/cute-frog-9259/asd223222f4
 * - slug: cute-frog-9259
 * - instance-id: asd223222f4
 */

import { Lazy } from '@adviser/cement';
import { ensureSuperThis, runtimeFn } from '@fireproof/core-runtime';

const sthis = Lazy(() => ensureSuperThis());

// Default fallback app slug when detection fails
const DEFAULT_APP_SLUG = 'atmospheric-tiger-9377';

/**
 * Extract the app slug from the current URL
 *
 * @returns The app slug (first segment after /vibe/)
 *
 * @example
 * // URL: http://vibes.diy/vibe/cute-frog-9259/asd223222f4
 * getAppSlug() // → "cute-frog-9259"
 */
export function getAppSlug(): string {
  if (!runtimeFn().isBrowser) {
    throw new Error('getAppSlug can only be called in a browser environment');
  }

  const { pathname } = window.location;

  // Parse path-based routing: /vibe/{slug}/{instance-id}
  if (pathname.startsWith('/vibe/')) {
    const pathPart = pathname.slice('/vibe/'.length); // Remove '/vibe/'
    if (pathPart) {
      const slug = pathPart.split('/')[0]; // Take first segment
      if (slug) {
        return slug;
      }
    }
  }

  throw new Error('Unable to determine app slug from URL');
}

/**
 * Extract the instance ID from the current URL
 *
 * @returns The instance ID (second segment after /vibe/) or undefined
 *
 * @example
 * // URL: http://vibes.diy/vibe/cute-frog-9259/asd223222f4
 * getInstanceId() // → "asd223222f4"
 */
export function getInstanceId(): string | undefined {
  if (!runtimeFn().isBrowser) {
    return undefined;
  }

  const { pathname } = window.location;

  // Parse path-based routing: /vibe/{slug}/{instance-id}
  if (pathname.startsWith('/vibe/')) {
    const pathPart = pathname.slice('/vibe/'.length); // Remove '/vibe/'
    if (pathPart) {
      const parts = pathPart.split('/');
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
    }
  }

  return undefined;
}

/**
 * Extract the full app identifier including instance ID if present
 *
 * @returns The full path after /vibe/ (e.g., "cute-frog-9259/asd223222f4")
 *
 * @example
 * // URL: http://vibes.diy/vibe/cute-frog-9259/asd223222f4
 * getFullAppIdentifier() // → "cute-frog-9259/asd223222f4"
 */
export function getFullAppIdentifier(): string {
  if (!runtimeFn().isBrowser) {
    return DEFAULT_APP_SLUG;
  }

  const { pathname } = window.location;

  // Parse path-based routing: /vibe/{slug}/{instance-id}
  if (pathname.startsWith('/vibe/')) {
    const pathPart = pathname.slice('/vibe/'.length); // Remove '/vibe/'
    if (pathPart) {
      // Remove trailing slash if present
      return pathPart.replace(/\/$/, '');
    }
  }

  return DEFAULT_APP_SLUG;
}

/**
 * Check if the current environment is development (path-based routing)
 *
 * @returns True if running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  if (!runtimeFn().isBrowser) {
    return false;
  }

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Check if the current environment is production (path-based routing)
 *
 * @returns True if running in production environment
 */
export function isProductionEnvironment(): boolean {
  if (!runtimeFn().isBrowser) {
    return false;
  }

  const { hostname } = window.location;
  return hostname.includes('.') && hostname !== 'localhost' && !hostname.startsWith('127.0.0.1');
}

/**
 * Generate a random instance ID for creating new app instances
 *
 * @returns A random instance ID (e.g., "abc123def456")
 */
export function generateRandomInstanceId(): string {
  return sthis().nextId().str;
}

/**
 * Generate a URL for a fresh data install (new instance with same app slug)
 *
 * @param baseURL - Base URL for the vibes platform
 * @returns Full URL for fresh install with new random instance ID
 */
export function generateFreshDataUrl(baseURL: string): string {
  const slug = getAppSlug();
  const instanceId = generateRandomInstanceId();
  return `${baseURL}/vibe/${slug}/${instanceId}`;
}

/**
 * Generate a URL for the remix/change code endpoint
 *
 * @param baseURL - Base URL for the vibes platform
 * @returns URL for remix endpoint
 */
export function generateRemixUrl(baseURL: string): string {
  const appSlug = getAppSlug();
  return `${baseURL}/remix/${appSlug}`;
}

/**
 * Alias for generateRandomInstanceId
 */
export const generateInstallId = generateRandomInstanceId;
