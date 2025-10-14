// Subdomain parser utility for routing between catalog titles and app instances
// Handles the underscore-based routing logic for the Install ID Architecture

export interface ParsedSubdomain {
  /** The app slug (part before underscore, or full subdomain if no underscore) */
  appSlug: string;
  /** The install ID (part after underscore, if present) */
  installId?: string;
  /** Whether this is an app instance (has underscore) or catalog title (no underscore) */
  isInstance: boolean;
  /** The original full subdomain for reference */
  fullSubdomain: string;
}

/**
 * Parse a subdomain to determine routing between catalog title and app instance
 *
 * @param hostname - The full hostname (e.g., "my-app_abc123.vibesdiy.app")
 * @returns Parsed subdomain information
 *
 * @example
 * parseSubdomain("my-app.vibesdiy.app")
 * // { appSlug: "my-app", isInstance: false, fullSubdomain: "my-app" }
 *
 * parseSubdomain("my-app_abc123.vibesdiy.app")
 * // { appSlug: "my-app", installId: "abc123", isInstance: true, fullSubdomain: "my-app_abc123" }
 */
export function parseSubdomain(hostname: string): ParsedSubdomain {
  // Extract the subdomain (first part before any dots)
  // Normalize to lowercase and trim for consistent behavior
  const subdomain = hostname.split(".")[0].toLowerCase().trim();

  // Check if subdomain contains underscore
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
  } else {
    // No underscore - this is a catalog title page
    return {
      appSlug: subdomain,
      installId: undefined,
      isInstance: false,
      fullSubdomain: subdomain,
    };
  }
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
 * Generate a new install ID for an app instance
 * Creates a 12-character alphanumeric ID
 *
 * @returns A 12-character alphanumeric install ID
 */
export function generateInstallId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";

  // Use crypto.getRandomValues if available for better randomness
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
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
 * Construct a subdomain string from parsed components
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
    return `${appSlug}_${installId}`;
  }
  return appSlug;
}
