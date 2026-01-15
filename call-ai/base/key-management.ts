/**
 * Key management functionality for call-ai
 */

import { CallAIErrorParams, Falsy } from "./types.js";
import { callAiEnv, type CallAIEnv } from "./env.js";

// Type for objects that have the environment properties we need
export interface EnvLike {
  readonly CALLAI_API_KEY?: unknown;
  readonly CALLAI_REFRESH_ENDPOINT?: unknown;
  readonly CALL_AI_REFRESH_TOKEN?: unknown;
  readonly CALLAI_DEBUG?: unknown;
}

export interface KeyMetadata {
  key: string;
  hash: string;
  created: Date;
  expires: Date;
  remaining: number;
  limit: number;
}

// Internal key store to keep track of the latest key
const _keyStore = {
  // Default key from environment or config
  current: undefined as string | undefined,
  // The refresh endpoint URL - defaults to vibecode.garden
  refreshEndpoint: "https://vibecode.garden",
  // Authentication token for refresh endpoint - defaults to use-vibes
  refreshToken: "use-vibes" as string | Falsy,
  // Flag to prevent concurrent refresh attempts
  isRefreshing: false,
  // Timestamp of last refresh attempt (to prevent too frequent refreshes)
  lastRefreshAttempt: 0,
  // Storage for key metadata (useful for future top-up implementation)
  metadata: {} as Record<string, Partial<KeyMetadata>>,
};

export function keyStore() {
  return _keyStore;
}

// Global debug flag
let globalDebug = false;

/**
 * Initialize key store with environment variables
 */
function initKeyStore(env: CallAIEnv | EnvLike = callAiEnv) {
  const store = keyStore();

  // Only use string values, treat non-strings as undefined
  store.current = typeof env.CALLAI_API_KEY === "string" ? env.CALLAI_API_KEY : undefined;
  store.refreshEndpoint = typeof env.CALLAI_REFRESH_ENDPOINT === "string" ? env.CALLAI_REFRESH_ENDPOINT : "https://vibecode.garden";
  store.refreshToken = typeof env.CALL_AI_REFRESH_TOKEN === "string" ? env.CALL_AI_REFRESH_TOKEN : "use-vibes";
  globalDebug = !!env.CALLAI_DEBUG;
}

// Initialize on module load
// initKeyStore();

/**
 * Check if an error indicates we need a new API key
 * @param error The error to check
 * @param debug Whether to log debug information
 * @returns True if the error suggests we need a new key
 */
function isNewKeyError(ierror: unknown, debug = false): boolean {
  const error = ierror as CallAIErrorParams;
  // Extract status from error object or message text
  let status = error?.status || error?.statusCode || error?.response?.status || 450;
  const errorMessage = String(error || "").toLowerCase();

  // Extract status code from error message if not found in the object properties
  // Handle messages like "HTTP error! Status: 403" common in fetch errors
  if (!status && errorMessage.includes("status:")) {
    const statusMatch = errorMessage.match(/status:\\s*(\\d+)/i);
    if (statusMatch && statusMatch[1]) {
      status = parseInt(statusMatch[1], 10);
    }
  }

  const is4xx = status >= 400 && status < 500;

  // Check for various error types that indicate key issues
  const isAuthError =
    status === 401 ||
    status === 403 ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("forbidden") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("api key") ||
    errorMessage.includes("apikey") ||
    errorMessage.includes("auth");

  // More specific message checks, especially for common API providers
  const isInvalidKeyError =
    errorMessage.includes("invalid api key") ||
    errorMessage.includes("invalid key") ||
    errorMessage.includes("incorrect api key") ||
    errorMessage.includes("incorrect key") ||
    errorMessage.includes("authentication failed") ||
    errorMessage.includes("not authorized");

  // Check for OpenAI specific error patterns
  const isOpenAIKeyError =
    errorMessage.includes("openai") && (errorMessage.includes("api key") || errorMessage.includes("authentication"));

  // Check for rate limit errors which might indicate a key top-up is needed
  const isRateLimitError =
    status === 429 ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests") ||
    errorMessage.includes("quota") ||
    errorMessage.includes("exceed");

  // Check for billing or payment errors
  const isBillingError =
    errorMessage.includes("billing") ||
    errorMessage.includes("payment") ||
    errorMessage.includes("subscription") ||
    errorMessage.includes("account");

  // Simple heuristic: if it's a 4xx error with any key-related terms, likely needs key refresh
  const needsNewKey = is4xx && (isAuthError || isInvalidKeyError || isOpenAIKeyError || isRateLimitError || isBillingError);

  if (debug && needsNewKey) {
    console.log(`[callAi:key-refresh] Detected error requiring key refresh: ${errorMessage}`);
  }

  return needsNewKey;
}

/**
 * Helper function to extract hash from key (implementation depends on how you store metadata)
 */
function getHashFromKey(key: string): string | null {
  if (!key) return null;
  // Simple implementation: just look up in our metadata store
  const metaKey = Object.keys(keyStore().metadata).find((k) => k === key);
  return metaKey ? keyStore().metadata[metaKey].hash || null : null;
}

/**
 * Helper function to store key metadata for future reference
 */
function storeKeyMetadata(data: KeyMetadata): void {
  if (!data || !data.key) return;

  // Store metadata with the key as the dictionary key
  keyStore().metadata[data.key] = {
    hash: data.hash,
    created: data.created || new Date(),
    expires: data.expires,
    remaining: data.remaining,
    limit: data.limit,
  };
}

export { globalDebug, initKeyStore, isNewKeyError, getHashFromKey, storeKeyMetadata };
