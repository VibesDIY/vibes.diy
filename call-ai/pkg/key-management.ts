/**
 * Key management functionality for call-ai
 */

import { CallAIErrorParams, Falsy, Mocks, KeyRefreshResponse } from "./types.js";
import { callAiFetch, entriesHeaders } from "./utils.js";
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
 * Refreshes the API key by calling the specified endpoint
 * @param currentKey The current API key (may be null for initial key request)
 * @param endpoint The endpoint to call for key refresh
 * @param refreshToken Authentication token for the refresh endpoint
 * @returns Object containing the API key and topup flag
 */
async function refreshApiKey(
  options: { mock?: Mocks },
  currentKey: string | Falsy,
  endpoint: string | Falsy,
  refreshToken: string | Falsy,
  debug: boolean = globalDebug,
): Promise<{ apiKey: string; topup: boolean }> {
  // Ensure we have an endpoint and refreshToken
  if (!endpoint) {
    throw new Error("No API key refresh endpoint specified");
  }

  if (!refreshToken) {
    throw new Error("No API key refresh token specified");
  }

  // Check if we're already in the process of refreshing (to prevent parallel refreshes)
  if (keyStore().isRefreshing) {
    if (debug) {
      console.log("API key refresh already in progress, waiting...");
    }
    // Wait for refresh to complete (simple polling)
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!keyStore().isRefreshing && keyStore().current) {
          clearInterval(checkInterval);
          const ck = keyStore().current;
          if (!ck) {
            throw new Error("API key refresh failed");
          }
          resolve({ apiKey: ck, topup: false });
        }
      }, 100);
    });
  }

  // Rate limit key refresh to prevent overloading the service
  const now = Date.now();
  const timeSinceLastRefresh = now - keyStore().lastRefreshAttempt;
  const minRefreshInterval = 2000; // 2 seconds minimum interval between refreshes

  if (timeSinceLastRefresh < minRefreshInterval) {
    if (debug) {
      console.log(`Rate limiting key refresh, last attempt was ${timeSinceLastRefresh}ms ago`);
    }
    // If we've refreshed too recently, wait a bit
    await new Promise((resolve) => setTimeout(resolve, minRefreshInterval - timeSinceLastRefresh));
  }

  // Set refreshing flag and update last attempt timestamp
  keyStore().isRefreshing = true;
  keyStore().lastRefreshAttempt = Date.now();

  // Process API paths
  const apiPath = "/api/keys";

  // Normalize endpoint URL to remove any trailing slashes
  const baseUrl = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;

  // Construct the full URL
  const url = `${baseUrl}${apiPath}`;

  if (debug) {
    console.log(`Refreshing API key from: ${url}`);
  }

  try {
    // Request payload
    const requestPayload = {
      key: currentKey,
      hash: currentKey ? getHashFromKey(currentKey) : null,
      name: "call-ai-client", // Add the required name field
    };

    if (debug) {
      console.log(`[callAi:key-refresh] Request URL: ${url}`);
      console.log(`[callAi:key-refresh] Request headers:`, {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      });
      console.log(`[callAi:key-refresh] Request payload:`, requestPayload);
    }

    // Make the request
    const response = await callAiFetch(options)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (debug) {
      console.log(`[callAi:key-refresh] Response status: ${response.status} ${response.statusText}`);

      console.log(`[callAi:key-refresh] Response headers:`, Object.fromEntries([...entriesHeaders(response.headers)]));
    }

    if (!response.ok) {
      // Try to get the response body for more details
      const errorText = await response.text();
      if (debug) {
        console.log(`[callAi:key-refresh] Error response body: ${errorText}`);
      }
      throw new Error(`API key refresh failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }

    // Parse the response
    const data = (await response.json()) as KeyRefreshResponse;

    // Log the complete response structure for debugging
    if (debug) {
      console.log(`[callAi:key-refresh] Full response structure:`, JSON.stringify(data, null, 2));
    }

    // Handle different API response formats
    let newKey: string;

    // Check if response has the new nested format with data.key.key
    if (data.key && typeof data.key === "object" && data.key.key) {
      newKey = data.key.key;
    }
    // Check for old format where data.key is the string key directly
    else if (data.key && typeof data.key === "string") {
      newKey = data.key;
    }
    // Handle error case
    else {
      throw new Error("Invalid response from key refresh endpoint: missing or malformed key");
    }

    if (debug) {
      console.log(`API key refreshed successfully: ${newKey.substring(0, 10)}...`);
    }

    // Store metadata for potential future use (like top-up)
    if (data.metadata || (data.key && typeof data.key === "object" && data.key.metadata)) {
      const metadata = data.metadata || (typeof data.key === "object" ? data.key.metadata : undefined);
      if (metadata) {
        storeKeyMetadata(metadata as KeyMetadata);
      }
    }

    // Update the key store with the string value
    keyStore().current = newKey;

    // Determine if this was a top-up (using existing key) or new key
    // For the new API response format, hash is in data.key.hash
    const hashValue = data.hash || (data.key && typeof data.key === "object" && data.key.hash);
    const isTopup = Boolean(currentKey && hashValue && hashValue === getHashFromKey(currentKey));

    // Reset refreshing flag
    keyStore().isRefreshing = false;

    return {
      apiKey: newKey, // Return the string key, not the object
      topup: isTopup,
    };
  } catch (error) {
    // Reset refreshing flag
    keyStore().isRefreshing = false;
    throw error;
  }
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
    created: data.created || Date.now(),
    expires: data.expires,
    remaining: data.remaining,
    limit: data.limit,
  };
}

export { globalDebug, initKeyStore, isNewKeyError, refreshApiKey, getHashFromKey, storeKeyMetadata };
