/**
 * Subdomain parsing utilities for hosting module
 *
 * This is a copy of the subdomain logic from use-vibes-base (HEAD version)
 * to maintain compatibility with legacy subdomain-based routing while
 * use-vibes moves to path-based routing.
 */

import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";

const sthis = Lazy(() => ensureSuperThis());

export interface ParsedSubdomain {
  /** The app slug (part before underscore/double-dash, or full subdomain if no separator) */
  readonly appSlug: string;
  /** The install ID (part after underscore/double-dash, if present) */
  readonly installId?: string;
  /** Whether this is an app instance (has separator) or catalog title (no separator) */
  readonly isInstance: boolean;
  /** The original full subdomain for reference */
  readonly fullSubdomain: string;
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
  const subdomain = hostname.split(".")[0].toLowerCase().trim();

  // Check for new format first (v- prefix with --)
  if (subdomain.startsWith("v-")) {
    const withoutPrefix = subdomain.slice(2); // Remove "v-"
    if (withoutPrefix.includes("--")) {
      // Split on double dash to get app slug and install ID
      const parts = withoutPrefix.split("--");
      const appSlug = parts[0];
      const installId = parts.slice(1).join("--"); // Handle multiple double dashes by rejoining

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
  if (subdomain.includes("_")) {
    // Split on underscore to get app slug and install ID
    const parts = subdomain.split("_");
    const appSlug = parts[0];
    const installId = parts.slice(1).join("_"); // Handle multiple underscores by rejoining

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
 * Always uses new v-slug--installId format for all domains
 *
 * @param appSlug - The app slug
 * @param installId - Optional install ID for instances
 * @returns The constructed subdomain string
 * @throws Error if installId is empty string (would create invalid subdomain)
 */
export function constructSubdomain(
  appSlug: string,
  installId?: string,
): string {
  if (installId !== undefined) {
    if (installId.trim().length === 0) {
      throw new Error(
        "Install ID cannot be empty string - would create invalid subdomain",
      );
    }

    // All domains now use the new format with v- prefix and -- separator
    return `v-${appSlug}--${installId}`;
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
  if (
    parsed.isInstance &&
    (!parsed.installId || parsed.installId.trim().length === 0)
  ) {
    return false;
  }

  // Validate DNS label compliance for app slug
  if (!isValidDNSLabel(parsed.appSlug)) {
    return false;
  }

  // Validate install ID if present
  if (
    parsed.isInstance &&
    parsed.installId &&
    !isValidInstallId(parsed.installId)
  ) {
    return false;
  }

  // Check for reserved subdomains
  const reservedSubdomains = ["www", "api", "admin", "app"];
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
 * Generate a random instance ID for creating new app instances
 *
 * @returns A random instance ID (e.g., "abc123", "xyz789")
 */
export function generateRandomInstanceId(): string {
  return sthis().nextId().str;
}

/**
 * Alias for generateRandomInstanceId for hosting module compatibility
 */
export const generateInstallId = generateRandomInstanceId;
