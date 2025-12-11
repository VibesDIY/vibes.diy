/**
 * Clerk environment configuration helper for server-side rendering
 *
 * This is a lightweight version without dependencies on call-ai or other packages,
 * specifically for the Deno server to determine which Clerk key to use.
 */

/**
 * Get the appropriate Clerk publishable key based on hostname
 *
 * @param hostname - The hostname from the request (e.g., "localhost", "vibes.diy")
 * @returns The appropriate Clerk publishable key (test or live)
 */
export function getClerkKeyForHostname(hostname: string): string {
  const isProduction = hostname === "vibes.diy";
  return isProduction
    ? "pk_live_Y2xlcmsudmliZXMuZGl5JA"
    : "pk_test_c2luY2VyZS1jaGVldGFoLTMwLmNsZXJrLmFjY291bnRzLmRldiQ";
}
