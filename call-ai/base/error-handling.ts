/**
 * Error handling utilities for call-ai
 */
import { globalDebug, isNewKeyError } from "./key-management.js";
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

  // Check if this is an authentication error that suggests using proper auth
  const needsAuth = isNewKeyError(error, debug) || isMissingKeyError;

  if (needsAuth && debug) {
    console.log(`[callAi:auth] Authentication error detected. Ensure proper authentication tokens are provided.`);
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
