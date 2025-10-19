/**
 * Universal app slug extraction utility
 *
 * Handles both production subdomain-based URLs and development path-based URLs:
 * - Production: vienna-tiger-7779_frog.vibesdiy.net → vienna-tiger-7779
 * - Development: localhost:3456/vibe/vienna-tiger-7779_jchris → vienna-tiger-7779
 */

/**
 * Extract the app slug from the current URL
 *
 * This function intelligently detects the environment and extracts the app slug
 * from either subdomain (production) or pathname (development).
 *
 * @returns The app slug (part before underscore if present)
 *
 * @example
 * // Production subdomain-based
 * // URL: https://vienna-tiger-7779_frog.vibesdiy.net
 * getAppSlug() // → "vienna-tiger-7779"
 *
 * @example
 * // Development path-based
 * // URL: http://localhost:3456/vibe/vienna-tiger-7779_jchris
 * getAppSlug() // → "vienna-tiger-7779"
 */
export function getAppSlug(): string {
  if (typeof window === 'undefined') {
    return 'unknown-app';
  }

  const { hostname, pathname } = window.location;

  // Check for path-based routing (development environments)
  // Matches patterns like /vibe/app-slug or /vibe/app-slug_instance
  if (pathname.startsWith('/vibe/')) {
    const pathPart = pathname.split('/vibe/')[1];
    if (pathPart) {
      const slug = pathPart.split('/')[0]; // Take first segment after /vibe/
      return slug.split('_')[0]; // Extract part before underscore
    }
  }

  // Check for subdomain-based routing (production environments)
  // Matches patterns like app-slug.domain.com or app-slug_instance.domain.com
  if (hostname.includes('.')) {
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
      return subdomain.split('_')[0]; // Extract part before underscore
    }
  }

  // Fallback for localhost or other edge cases
  // This handles cases like localhost:3000 without /vibe/ path
  const fallbackSlug = hostname.split('_')[0];
  if (fallbackSlug !== 'localhost') {
    return fallbackSlug;
  }

  // Final fallback
  return 'unknown-app';
}

/**
 * Extract the full app identifier including instance ID if present
 *
 * @returns The full app identifier (including underscore and instance ID)
 *
 * @example
 * // URL: https://vienna-tiger-7779_frog.vibesdiy.net
 * getFullAppIdentifier() // → "vienna-tiger-7779_frog"
 */
export function getFullAppIdentifier(): string {
  if (typeof window === 'undefined') {
    return 'unknown-app';
  }

  const { hostname, pathname } = window.location;

  // Check for path-based routing (development environments)
  if (pathname.startsWith('/vibe/')) {
    const pathPart = pathname.split('/vibe/')[1];
    if (pathPart) {
      return pathPart.split('/')[0]; // Take first segment after /vibe/
    }
  }

  // Check for subdomain-based routing (production environments)
  if (hostname.includes('.')) {
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
      return subdomain;
    }
  }

  // Fallback
  return hostname !== 'localhost' ? hostname : 'unknown-app';
}

/**
 * Check if the current environment is development (path-based routing)
 *
 * @returns True if running in development environment
 */
export function isDevelopmentEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname, pathname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || pathname.startsWith('/vibe/');
}

/**
 * Check if the current environment is production (subdomain-based routing)
 *
 * @returns True if running in production environment
 */
export function isProductionEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname } = window.location;
  return hostname.includes('.') && hostname !== 'localhost' && !hostname.startsWith('127.0.0.1');
}

/**
 * Generate a random instance ID for creating new app instances
 *
 * @returns A random instance ID (e.g., "abc123", "xyz789")
 */
export function generateRandomInstanceId(): string {
  // Generate a random string similar to pattern used in the platform
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a URL for a fresh data install (new instance with same app slug)
 *
 * @returns URL for fresh install with new random instance ID
 */
export function generateFreshDataUrl(): string {
  const appSlug = getAppSlug();
  const newInstanceId = generateRandomInstanceId();
  return `https://vibes.diy/vibe/${appSlug}_${newInstanceId}`;
}

/**
 * Generate a URL for the remix/change code endpoint
 *
 * @returns URL for remix endpoint
 */
export function generateRemixUrl(): string {
  const appSlug = getAppSlug();
  return `https://vibes.diy/remix/${appSlug}`;
}
