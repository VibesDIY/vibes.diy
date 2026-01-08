/**
 * Centralized authentication error handling utilities
 * Used to detect and handle auth-related errors consistently across the app
 */

/**
 * Sentinel value for authentication errors
 * Use this constant when throwing or checking for auth errors
 */
export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";

/**
 * Check if an error message indicates an authentication failure
 * Uses regex to match common auth error patterns
 *
 * @param msg - The error message to check
 * @returns true if the message indicates an auth error
 */
export function isAuthErrorMessage(msg: string): boolean {
  const normalized = msg.toLowerCase();
  // Match word boundaries to avoid false positives
  return /\b(401|unauthorized|authentication|authentication_error)\b/.test(
    normalized,
  );
}
