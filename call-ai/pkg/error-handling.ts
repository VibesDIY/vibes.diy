/**
 * Error handling utilities for call-ai
 */
import { keyStore, globalDebug, isNewKeyError, refreshApiKey } from "./key-management.js";
import { CallAIError, CallAIErrorParams, Mocks, APIErrorResponse } from "./types.js";

// Standardized API error handler
// @param error The error object
// @param context Context description for error messages
// @param debug Whether to log debug information
// @param options Options for error handling including key refresh control
async function handleApiError(
  ierror: unknown,
  context: string,
  debug: boolean = globalDebug,
  options: {
    apiKey?: string;
    endpoint?: string;
    skipRefresh?: boolean;
    refreshToken?: string;
    updateRefreshToken?: (currentToken: string) => Promise<string>;
    mock?: Mocks;
  } = {},
): Promise<void> {
  const error = ierror as CallAIErrorParams;

  // Extract error details
  const errorMessage = error?.message || String(error);
  const status =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    (errorMessage.match(/status: (\d+)/i)?.[1] && parseInt(errorMessage.match(/status: (\d+)/i)?.[1] ?? "500"));

  // Check if this is a missing API key error
  const isMissingKeyError = errorMessage.includes("API key is required");

  if (debug) {
    console.error(`[callAi:error] ${context} error:`, {
      message: errorMessage,
      status,
      name: error?.name,
      cause: error?.cause,
      isMissingKey: isMissingKeyError,
    });
  }

  // Don't attempt API key refresh if explicitly skipped
  if (options.skipRefresh) {
    throw error;
  }

  // Determine if this error suggests we need a new API key
  // Either it's a specific key error OR we have no key at all
  const needsNewKey = isNewKeyError(error, debug) || isMissingKeyError;

  // If the error suggests an API key issue, try to refresh the key
  if (needsNewKey) {
    if (debug) {
      console.log(`[callAi:key-refresh] Error suggests API key issue, attempting refresh...`);
    }

    try {
      // Use provided key/endpoint/refreshToken or fallback to global configuration
      const currentKey = options.apiKey || keyStore().current;
      const endpoint = options.endpoint || keyStore().refreshEndpoint;
      const refreshToken = options.refreshToken || keyStore().refreshToken;

      // First attempt to refresh the API key
      try {
        const { apiKey, topup } = await refreshApiKey(options, currentKey, endpoint, refreshToken, debug);

        // Update the key in the store (if not already set by refreshApiKey)
        if (keyStore().current !== apiKey) {
          keyStore().current = apiKey;
        }

        if (debug) {
          console.log(`[callAi:key-refresh] ${topup ? "Topped up" : "Refreshed"} API key successfully`);
        }

        // Return without throwing since we've successfully recovered
        return;
      } catch (initialRefreshError) {
        // If there's an updateRefreshToken callback and the error was due to token issue
        if (options.updateRefreshToken && refreshToken) {
          if (debug) {
            console.log(`[callAi:key-refresh] Initial refresh failed, attempting to update refresh token`);
          }

          try {
            // Get a new refresh token using the callback
            const newRefreshToken = await options.updateRefreshToken(refreshToken);

            if (newRefreshToken && newRefreshToken !== refreshToken) {
              if (debug) {
                console.log(`[callAi:key-refresh] Got new refresh token, retrying key refresh`);
              }

              // Update the stored refresh token
              keyStore().refreshToken = newRefreshToken;

              // Try again with the new token
              const { apiKey, topup } = await refreshApiKey(options, currentKey, endpoint, newRefreshToken, debug);

              // Update the key in the store
              if (keyStore().current !== apiKey) {
                keyStore().current = apiKey;
              }

              if (debug) {
                console.log(
                  `[callAi:key-refresh] ${topup ? "Topped up" : "Refreshed"} API key successfully with new refresh token`,
                );
              }

              // Return without throwing since we've successfully recovered
              return;
            } else {
              if (debug) {
                console.log(`[callAi:key-refresh] No new refresh token provided or same token returned, cannot retry`);
              }
              // Continue to error handling
              throw initialRefreshError;
            }
          } catch (tokenUpdateError) {
            if (debug) {
              console.error(`[callAi:key-refresh] Failed to update refresh token:`, tokenUpdateError);
            }
            // Continue to error handling with the original refresh error
            throw initialRefreshError;
          }
        } else {
          // No updateRefreshToken callback or no token, rethrow the initial error
          throw initialRefreshError;
        }
      }
    } catch (refreshError) {
      // Log refresh failure but throw the original error
      if (debug) {
        console.error(`[callAi:key-refresh] API key refresh failed:`, refreshError);
      }
      // Create a more detailed error from the original one
      const detailedError = new CallAIError({
        message: `${errorMessage} (Key refresh failed: ${
          refreshError instanceof Error ? refreshError.message : String(refreshError)
        })`,
        originalError: error,
        refreshError,
        status: status || 401,
        contentType: "text/plain",
      });

      throw detailedError;
    }
  }

  // For non-key errors, create a detailed error object
  const detailedError = new CallAIError({
    message: `${context}: ${errorMessage}`,
    originalError: error,
    status: status || 500,
    errorType: error.name || "Error",
  });
  throw detailedError;
}

// Helper to check if an error indicates invalid model and handle fallback
async function checkForInvalidModelError(
  response: Response,
  model: string,
  debug: boolean = globalDebug,
): Promise<{ isInvalidModel: boolean; errorData?: APIErrorResponse }> {
  // Only check 4xx errors (which could indicate invalid model)
  if (response.status < 400 || response.status >= 500) {
    return { isInvalidModel: false };
  }

  // Clone the response so we can still use the original later if needed
  const responseClone = response.clone();

  // Try to parse the response as JSON
  let errorData: APIErrorResponse;
  try {
    errorData = (await responseClone.json()) as APIErrorResponse;
  } catch (e) {
    // If it's not JSON, get the text
    try {
      const text = await responseClone.text();
      errorData = { error: text };
    } catch (e) {
      errorData = { error: `Error ${response.status}: ${response.statusText}` };
    }
  }

  // Check if the error indicates an invalid model
  const isInvalidModelError =
    // Status checks
    response.status === 404 ||
    response.status === 400 ||
    // Response content checks
    (errorData &&
      errorData.error &&
      ((typeof errorData.error === "string" &&
        (errorData.error.toLowerCase().includes("model") ||
          errorData.error.toLowerCase().includes("engine") ||
          errorData.error.toLowerCase().includes("not found") ||
          errorData.error.toLowerCase().includes("invalid") ||
          errorData.error.toLowerCase().includes("unavailable"))) ||
        (typeof errorData.error === "object" &&
          errorData.error.message &&
          typeof errorData.error.message === "string" &&
          (errorData.error.message.toLowerCase().includes("model") ||
            errorData.error.message.toLowerCase().includes("engine") ||
            errorData.error.message.toLowerCase().includes("not found") ||
            errorData.error.message.toLowerCase().includes("invalid") ||
            errorData.error.message.toLowerCase().includes("unavailable")))));

  if (debug && isInvalidModelError) {
    console.log(`[callAi:model-fallback] Detected invalid model error for "${model}":`, errorData);
  }

  return { isInvalidModel: Boolean(isInvalidModelError), errorData };
}

export { handleApiError, checkForInvalidModelError };
