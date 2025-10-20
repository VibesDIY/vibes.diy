/**
 * Universal app slug extraction utility
 *
 * Handles both production subdomain-based URLs and development path-based URLs:
 * - Production (new): v-vienna-tiger-7779--frog.vibesdiy.net → vienna-tiger-7779
 * - Production (legacy): vienna-tiger-7779_frog.vibesdiy.net → vienna-tiger-7779
 * - Development: localhost:3456/vibe/vienna-tiger-7779_jchris → vienna-tiger-7779
 */

// Default fallback app slug when detection fails
const DEFAULT_APP_SLUG = 'atmospheric-tiger-9377';

/**
 * Extract the app slug from the current URL
 *
 * This function intelligently detects the environment and extracts the app slug
 * from either subdomain (production) or pathname (development).
 *
 * @returns The app slug (part before underscore if present)
 *
 * @example
 * // Production subdomain-based (new format)
 * // URL: https://v-vienna-tiger-7779--frog.vibesdiy.net
 * getAppSlug() // → "vienna-tiger-7779"
 *
 * @example
 * // Production subdomain-based (legacy format)
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
    return DEFAULT_APP_SLUG;
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
  // Matches both new (v-app-slug--instance) and legacy (app-slug_instance) patterns
  if (hostname.includes('.')) {
    const sub = hostname.split('.')[0];
    if (sub && sub !== 'www' && sub !== 'localhost') {
      const parsed = parseSubdomain(hostname);
      return parsed.appSlug || DEFAULT_APP_SLUG;
    }
  }

  // Safe fallback - always return a valid app slug
  return DEFAULT_APP_SLUG;
}

/**
 * Extract the full app identifier including instance ID if present
 *
 * @returns The full app identifier (including underscore and instance ID)
 *
 * @example
 * // URL: https://v-vienna-tiger-7779--frog.vibesdiy.net
 * getFullAppIdentifier() // → "vienna-tiger-7779--frog"
 *
 * @example
 * // Legacy URL: https://vienna-tiger-7779_frog.vibesdiy.net
 * getFullAppIdentifier() // → "vienna-tiger-7779_frog"
 */
export function getFullAppIdentifier(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_SLUG;
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
    const sub = hostname.split('.')[0];
    if (sub && sub !== 'www' && sub !== 'localhost') {
      const parsed = parseSubdomain(hostname);
      if (parsed.isInstance && parsed.installId) {
        // Preserve original separator style based on the original subdomain
        if (parsed.fullSubdomain.startsWith('v-')) {
          return `${parsed.appSlug}--${parsed.installId}`;
        }
        return `${parsed.appSlug}_${parsed.installId}`;
      }
      return parsed.appSlug;
    }
  }

  // Safe fallback - always return a valid app identifier
  return DEFAULT_APP_SLUG;
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
  // Generate a 12-character alphanumeric ID for compatibility with hosting module expectations
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';

  // Use crypto.getRandomValues if available for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback to Math.random()
    for (let i = 0; i < 12; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}

/**
 * Generate a URL for a fresh data install (new instance with same app slug)
 *
 * @returns URL for fresh install with new random instance ID using new v-slug--installID format
 */
export function generateFreshDataUrl(): string {
  const appSlug = getAppSlug();
  const newInstanceId = generateRandomInstanceId();
  return `https://v-${appSlug}--${newInstanceId}.vibesdiy.net`;
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

// =============================================================================
// Functions for hosting module compatibility
// =============================================================================

export interface ParsedSubdomain {
  /** The app slug (part before underscore/double-dash, or full subdomain if no separator) */
  appSlug: string;
  /** The install ID (part after underscore/double-dash, if present) */
  installId?: string;
  /** Whether this is an app instance (has separator) or catalog title (no separator) */
  isInstance: boolean;
  /** The original full subdomain for reference */
  fullSubdomain: string;
}

/**
 * Parse a subdomain to determine routing between catalog title and app instance
 * Supports both new v-slug--installId and legacy slug_installId formats
 *
 * @param hostname - The full hostname (e.g., "v-my-app--abc123.vibesdiy.net")
 * @returns Parsed subdomain information
 *
 * @example
 * parseSubdomain("my-app.vibesdiy.app")
 * // { appSlug: "my-app", isInstance: false, fullSubdomain: "my-app" }
 *
 * @example
 * parseSubdomain("v-my-app--abc123.vibesdiy.net")
 * // { appSlug: "my-app", installId: "abc123", isInstance: true, fullSubdomain: "v-my-app--abc123" }
 *
 * @example
 * parseSubdomain("my-app_abc123.vibesdiy.app")
 * // { appSlug: "my-app", installId: "abc123", isInstance: true, fullSubdomain: "my-app_abc123" }
 */
export function parseSubdomain(hostname: string): ParsedSubdomain {
  // Extract the subdomain (first part before any dots)
  // Normalize to lowercase and trim for consistent behavior
  const subdomain = hostname.split('.')[0].toLowerCase().trim();

  // Check for new format first (v- prefix with --)
  if (subdomain.startsWith('v-')) {
    const withoutPrefix = subdomain.slice(2); // Remove "v-"
    if (withoutPrefix.includes('--')) {
      // Split on double dash to get app slug and install ID
      const parts = withoutPrefix.split('--');
      const appSlug = parts[0];
      const installId = parts.slice(1).join('--'); // Handle multiple double dashes by rejoining

      return {
        appSlug,
        installId,
        isInstance: true,
        fullSubdomain: subdomain,
      };
    } else {
      // Has v- prefix but no --, treat as catalog title
      return {
        appSlug: withoutPrefix,
        installId: undefined,
        isInstance: false,
        fullSubdomain: subdomain,
      };
    }
  }

  // Check for legacy format (underscore)
  if (subdomain.includes('_')) {
    // Split on underscore to get app slug and install ID
    const parts = subdomain.split('_');
    const appSlug = parts[0];
    const installId = parts.slice(1).join('_'); // Handle multiple underscores by rejoining

    return {
      appSlug,
      installId,
      isInstance: true,
      fullSubdomain: subdomain,
    };
  }

  // No separator - this is a catalog title page
  return {
    appSlug: subdomain,
    installId: undefined,
    isInstance: false,
    fullSubdomain: subdomain,
  };
}

/**
 * Construct a subdomain string from parsed components
 * Domain-aware: .net uses new v-slug--installId format, others use legacy slug_installId
 *
 * @param appSlug - The app slug
 * @param installId - Optional install ID for instances
 * @param domain - Optional domain to determine format (defaults to current hostname)
 * @returns The constructed subdomain string
 * @throws Error if installId is empty string (would create invalid subdomain)
 */
export function constructSubdomain(appSlug: string, installId?: string, domain?: string): string {
  if (installId !== undefined) {
    if (installId.trim().length === 0) {
      throw new Error('Install ID cannot be empty string - would create invalid subdomain');
    }

    // Determine domain for format selection
    const targetDomain =
      domain ||
      (typeof window !== 'undefined'
        ? window.location.hostname.split('.').slice(1).join('.')
        : 'vibesdiy.app');

    // Domain-aware format selection
    if (targetDomain.endsWith('.net')) {
      return `v-${appSlug}--${installId}`; // New format for .net
    } else {
      return `${appSlug}_${installId}`; // Legacy format for .app and others
    }
  }
  return appSlug;
}

/**
 * Validate that a parsed subdomain is valid for app routing
 * Validates both app slug and install ID for proper DNS label compliance
 *
 * @param parsed - The parsed subdomain result
 * @returns Whether the subdomain is valid for routing
 */
export function isValidSubdomain(parsed: ParsedSubdomain): boolean {
  // App slug must be non-empty
  if (!parsed.appSlug || parsed.appSlug.trim().length === 0) {
    return false;
  }

  // If it's an instance, install ID must be non-empty
  if (parsed.isInstance && (!parsed.installId || parsed.installId.trim().length === 0)) {
    return false;
  }

  // Validate DNS label compliance for app slug
  if (!isValidDNSLabel(parsed.appSlug)) {
    return false;
  }

  // Validate install ID if present
  if (parsed.isInstance && parsed.installId && !isValidInstallId(parsed.installId)) {
    return false;
  }

  // Check for reserved subdomains
  const reservedSubdomains = ['www', 'api', 'admin', 'app'];
  if (reservedSubdomains.includes(parsed.appSlug.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Validate a DNS label (RFC 1123 compliant)
 * @param label - The label to validate
 * @returns Whether the label is valid
 */
function isValidDNSLabel(label: string): boolean {
  // DNS label rules: 1-63 chars, alphanumeric + hyphens, no leading/trailing hyphens
  if (label.length === 0 || label.length > 63) {
    return false;
  }

  // Must start and end with alphanumeric
  if (!/^[a-z0-9]/.test(label) || !/[a-z0-9]$/.test(label)) {
    return false;
  }

  // Can only contain alphanumeric and hyphens
  return /^[a-z0-9-]+$/.test(label);
}

/**
 * Validate an install ID
 * @param installId - The install ID to validate
 * @returns Whether the install ID is valid
 */
function isValidInstallId(installId: string): boolean {
  // Install IDs can be more flexible than DNS labels
  // Allow alphanumeric, hyphens, and underscores
  if (installId.length === 0 || installId.length > 100) {
    return false;
  }

  return /^[a-zA-Z0-9_-]+$/.test(installId);
}

/**
 * Alias for generateRandomInstanceId for hosting module compatibility
 */
export const generateInstallId = generateRandomInstanceId;
