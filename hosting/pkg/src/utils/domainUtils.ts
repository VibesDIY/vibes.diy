// Domain detection utilities for routing between custom domains and first-party domains
// Centralizes domain classification logic to avoid drift

// First-party domain constants
export const FIRST_PARTY_DOMAINS = [".vibesdiy.app", ".vibesdiy.work", ".vibecode.garden"] as const;
export const FIRST_PARTY_APEX_DOMAINS = ["vibesdiy.app", "vibesdiy.work", "vibecode.garden"] as const;

/**
 * Check if a hostname is a custom domain (not owned by us)
 * @param hostname - The hostname to check
 * @returns true if this is a custom domain, false if it's one of our domains
 */
export function isCustomDomain(hostname: string): boolean {
  // Check for apex domains first
  if (FIRST_PARTY_APEX_DOMAINS.includes(hostname as any)) {
    return false;
  }

  // Check for subdomains of our domains
  return !FIRST_PARTY_DOMAINS.some((domain) => hostname.endsWith(domain));
}

/**
 * Check if a hostname is a first-party apex domain
 * @param hostname - The hostname to check
 * @returns true if this is one of our apex domains
 */
export function isFirstPartyApexDomain(hostname: string): boolean {
  return FIRST_PARTY_APEX_DOMAINS.includes(hostname as any);
}

/**
 * Check if a hostname is a first-party subdomain
 * @param hostname - The hostname to check
 * @returns true if this is a subdomain of one of our domains
 */
export function isFirstPartySubdomain(hostname: string): boolean {
  return (
    FIRST_PARTY_DOMAINS.some((domain) => hostname.endsWith(domain)) &&
    !FIRST_PARTY_APEX_DOMAINS.includes(hostname as any)
  );
}

/**
 * Extract the first-party domain from a hostname
 * @param hostname - The hostname to extract domain from
 * @returns The first-party domain (e.g., "vibesdiy.app") or null if not a first-party domain
 */
export function getFirstPartyDomain(hostname: string): string | null {
  // Check for apex domains first
  for (const apexDomain of FIRST_PARTY_APEX_DOMAINS) {
    if (hostname === apexDomain) {
      return apexDomain;
    }
  }

  // Check for subdomains
  for (const domain of FIRST_PARTY_DOMAINS) {
    if (hostname.endsWith(domain)) {
      // Extract the apex domain by removing the leading dot
      return domain.substring(1);
    }
  }

  return null;
}
