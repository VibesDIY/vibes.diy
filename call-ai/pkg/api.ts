/**
 * Core API implementation for call-ai
 */
import {
  CallAIError,
  CallAIOptions,
  Message,
  ResponseMeta,
  SchemaStrategy,
  StreamResponse,
  APIResponse,
  ModelId,
  AIResult,
} from "./types.js";
import { chooseSchemaStrategy } from "./strategies/index.js";
import { responseMetadata, boxString, getMeta } from "./response-metadata.js";
import { keyStore, globalDebug } from "./key-management.js";
import { handleApiError, checkForInvalidModelError } from "./error-handling.js";
import { createBackwardCompatStreamingProxy } from "./api-core.js";
import { extractContent, extractClaudeResponse, PACKAGE_VERSION } from "./non-streaming.js";
import { createStreamingGenerator } from "./streaming.js";
import { callAiFetch, joinUrlParts } from "./utils.js";
import { callAiEnv } from "./env.js";

// Key management is now imported from ./key-management

// initKeyStore is imported from key-management.ts
// No need to call initKeyStore() here as it's called on module load in key-management.ts

// isNewKeyError is imported from key-management.ts

// refreshApiKey is imported from key-management.ts

// getHashFromKey is imported from key-management.ts

// storeKeyMetadata is imported from key-management.ts

// Response metadata is now imported from ./response-metadata

// boxString and getMeta functions are now imported from ./response-metadata
// Re-export getMeta to maintain backward compatibility
export { getMeta };

// Import package version for debugging

// Default fallback model when the primary model fails or is unavailable
const FALLBACK_MODEL = "openrouter/auto";

/**
 * Make an AI API call with the given options
 * @param prompt User prompt as string or an array of message objects
 * @param options Configuration options including optional schema for structured output
 * @returns A Promise that resolves to the complete response string when streaming is disabled,
 *          or a Promise that resolves to an AsyncGenerator when streaming is enabled.
 *          The AsyncGenerator yields partial responses as they arrive.
 */
export function callAi(prompt: string | Message[], options: CallAIOptions = {}): Promise<string | StreamResponse> {
  // Check if we need to force streaming based on model strategy
  const schemaStrategy = chooseSchemaStrategy(options.model, options.schema || null);

  // We no longer set a default maxTokens
  // Will only include max_tokens in the request if explicitly set by the user

  // Handle special case: Claude with tools requires streaming
  if (!options.stream && schemaStrategy.shouldForceStream) {
    // Buffer streaming results into a single response
    return bufferStreamingResults(prompt, options);
  }

  // Handle normal non-streaming mode
  if (options.stream !== true) {
    return callAINonStreaming(prompt, options);
  }

  // Handle streaming mode - return a Promise that resolves to an AsyncGenerator
  // but also supports legacy non-awaited usage for backward compatibility
  const streamPromise = (async () => {
    // Do setup and validation before returning the generator
    const { endpoint, requestOptions, model, schemaStrategy } = prepareRequestParams(prompt, { ...options, stream: true });

    // Use either explicit debug option or global debug flag
    const debug = options.debug || globalDebug;
    if (debug) {
      console.log(`[callAi:${PACKAGE_VERSION}] Making fetch request to: ${endpoint}`);
      console.log(`[callAi:${PACKAGE_VERSION}] With model: ${model}`);
      console.log(`[callAi:${PACKAGE_VERSION}] Request headers:`, JSON.stringify(requestOptions.headers));
    }

    let response;
    try {
      response = await callAiFetch(options)(endpoint, requestOptions);
      if (options.debug) {
        console.log(`[callAi:${PACKAGE_VERSION}] Fetch completed with status:`, response.status, response.statusText);

        // Log all headers
        console.log(`[callAi:${PACKAGE_VERSION}] Response headers:`);
        response.headers.forEach((value, name) => {
          console.log(`[callAi:${PACKAGE_VERSION}]   ${name}: ${value}`);
        });

        // Clone response for diagnostic purposes only
        const diagnosticResponse = response.clone();
        try {
          // Try to get the response as text for debugging
          const responseText = await diagnosticResponse.text();
          console.log(
            `[callAi:${PACKAGE_VERSION}] First 500 chars of response body:`,
            responseText.substring(0, 500) + (responseText.length > 500 ? "..." : ""),
          );
        } catch (e) {
          console.log(`[callAi:${PACKAGE_VERSION}] Could not read response body for diagnostics:`, e);
        }
      }
    } catch (fetchError) {
      if (options.debug) {
        console.error(`[callAi:${PACKAGE_VERSION}] Network error during fetch:`, fetchError);
      }
      throw fetchError; // Re-throw network errors
    }

    // Explicitly check for HTTP error status and log extensively if debug is enabled
    // Safe access to headers in case of mock environments
    const contentType = response?.headers?.get?.("content-type") || "";

    if (options.debug) {
      console.log(`[callAi:${PACKAGE_VERSION}] Response.ok =`, response.ok);
      console.log(`[callAi:${PACKAGE_VERSION}] Response.status =`, response.status);
      console.log(`[callAi:${PACKAGE_VERSION}] Response.statusText =`, response.statusText);
      console.log(`[callAi:${PACKAGE_VERSION}] Response.type =`, response.type);
      console.log(`[callAi:${PACKAGE_VERSION}] Content-Type =`, contentType);
    }

    // Browser-compatible error handling - must check BOTH status code AND content-type
    // Some browsers will report status 200 for SSE streams even when server returns 400
    const hasHttpError = !response.ok || response.status >= 400;
    const hasJsonError = contentType.includes("application/json");

    if (hasHttpError || hasJsonError) {
      if (options.debug) {
        console.log(
          `[callAi:${PACKAGE_VERSION}] ⚠️ Error detected - HTTP Status: ${response.status}, Content-Type: ${contentType}`,
        );
      }

      // Handle the error with fallback model if appropriate
      if (!options.skipRetry) {
        const clonedResponse = response.clone();
        let isInvalidModel = false;

        try {
          // Check if this is an invalid model error
          const modelCheckResult = await checkForInvalidModelError(clonedResponse, model, options.debug);
          isInvalidModel = modelCheckResult.isInvalidModel;

          if (isInvalidModel) {
            if (options.debug) {
              console.log(`[callAi:${PACKAGE_VERSION}] Retrying with fallback model: ${FALLBACK_MODEL}`);
            }
            // Retry with fallback model
            return (await callAi(prompt, {
              ...options,
              model: FALLBACK_MODEL,
            })) as StreamResponse;
          }
        } catch (modelCheckError) {
          console.error(`[callAi:${PACKAGE_VERSION}] Error during model check:`, modelCheckError);
          // Continue with normal error handling
        }
      }

      // Extract error details from response
      try {
        // Try to get error details from the response body
        const errorBody = await response.text();
        if (options.debug) {
          console.log(`[callAi:${PACKAGE_VERSION}] Error body:`, errorBody);
        }

        try {
          // Try to parse JSON error
          const errorJson = JSON.parse(errorBody);
          if (options.debug) {
            console.log(`[callAi:${PACKAGE_VERSION}] Parsed error:`, errorJson);
          }

          // Extract message from OpenRouter error format
          let errorMessage = "";

          // Handle common error formats
          if (errorJson.error && typeof errorJson.error === "object" && errorJson.error.message) {
            // OpenRouter/OpenAI format: { error: { message: "..." } }
            errorMessage = errorJson.error.message;
          } else if (errorJson.error && typeof errorJson.error === "string") {
            // Simple error format: { error: "..." }
            errorMessage = errorJson.error;
          } else if (errorJson.message) {
            // Generic format: { message: "..." }
            errorMessage = errorJson.message;
          } else {
            // Fallback with status details
            errorMessage = `API returned ${response.status}: ${response.statusText}`;
          }

          // Add status details to error message if not already included
          if (!errorMessage.includes(response.status.toString())) {
            errorMessage = `${errorMessage} (Status: ${response.status})`;
          }

          if (options.debug) {
            console.log(`[callAi:${PACKAGE_VERSION}] Extracted error message:`, errorMessage);
          }

          // Create error with standard format
          const error = new CallAIError({
            message: errorMessage,
            status: response.status,
            statusText: response.statusText,
            details: errorJson,
            contentType,
          }); // Add useful metadata
          throw error;
        } catch (jsonError) {
          // If JSON parsing fails, extract a useful message from the raw error body
          if (options.debug) {
            console.log(`[callAi:${PACKAGE_VERSION}] JSON parse error:`, jsonError);
          }

          // Try to extract a useful message even from non-JSON text
          let errorMessage = "";

          // Check if it's a plain text error message
          if (errorBody && errorBody.trim().length > 0) {
            // Limit length for readability
            errorMessage = errorBody.length > 100 ? errorBody.substring(0, 100) + "..." : errorBody;
          } else {
            errorMessage = `API error: ${response.status} ${response.statusText}`;
          }

          // Add status details if not already included
          if (!errorMessage.includes(response.status.toString())) {
            errorMessage = `${errorMessage} (Status: ${response.status})`;
          }

          if (options.debug) {
            console.log(`[callAi:${PACKAGE_VERSION}] Extracted text error message:`, errorMessage);
          }

          const error = new CallAIError({
            message: errorMessage,
            status: response.status,
            statusText: response.statusText,
            details: errorBody,
            contentType,
          });
          throw error;
        }
      } catch (responseError) {
        if (responseError instanceof Error) {
          // Re-throw if it's already properly formatted
          throw responseError;
        }

        // Fallback error
        const error = new CallAIError({
          message: `API returned ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          contentType,
        });
        throw error;
      }
    }
    // Only if response is OK, create and return the streaming generator
    if (options.debug) {
      console.log(`[callAi:${PACKAGE_VERSION}] Response OK, creating streaming generator`);
    }
    return createStreamingGenerator(response, options, schemaStrategy, model);
  })();

  // For backward compatibility with v0.6.x where users didn't await the result
  if (process.env.NODE_ENV !== "production") {
    if (options.debug) {
      console.warn(
        `[callAi:${PACKAGE_VERSION}] No await found - using legacy streaming pattern. This will be removed in a future version and may cause issues with certain models.`,
      );
    }
  }

  // Create a proxy object that acts both as a Promise and an AsyncGenerator for backward compatibility
  return createBackwardCompatStreamingProxy(streamPromise);
}

/**
 * Buffer streaming results into a single response for cases where
 * we need to use streaming internally but the caller requested non-streaming
 */
async function bufferStreamingResults(prompt: string | Message[], options: CallAIOptions): Promise<string> {
  // Create a copy of options with streaming enabled
  const streamingOptions = {
    ...options,
    stream: true,
  };

  try {
    // Get streaming generator
    const generator = (await callAi(prompt, streamingOptions)) as AsyncGenerator<string, string, unknown>;

    // For Claude JSON responses, take only the last chunk (the final processed result)
    // For all other cases, concatenate chunks as before
    const isClaudeJson = /claude/.test(options.model || "") && options.schema;

    if (isClaudeJson) {
      // For Claude with JSON schema, we only want the last yielded value
      // which will be the complete, properly processed JSON
      let lastChunk = "";
      for await (const chunk of generator) {
        // Replace the last chunk entirely instead of concatenating
        lastChunk = chunk;
      }
      return lastChunk;
    } else {
      // For all other cases, concatenate chunks
      let result = "";
      for await (const chunk of generator) {
        result += chunk;
      }
      return result;
    }
  } catch (error) {
    // Handle errors with standard API error handling
    await handleApiError(error, "Buffered streaming", options.debug, {
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      skipRefresh: options.skipRefresh,
      refreshToken: options.refreshToken,
      updateRefreshToken: options.updateRefreshToken,
    });
    // If we get here, key was refreshed successfully, retry the operation with the new key
    // Retry with the refreshed key
    return bufferStreamingResults(prompt, {
      ...options,
      apiKey: keyStore().current, // Use the refreshed key from keyStore
    });
  }

  // This line should never be reached, but it satisfies the linter by ensuring
  // all code paths return a value
  throw new Error("Unexpected code path in bufferStreamingResults");
}

/**
 * Standardized API error handler
 */
// createBackwardCompatStreamingProxy is imported from api-core.ts

// handleApiError is imported from error-handling.ts

// checkForInvalidModelError is imported from error-handling.ts

/**
 * Prepare request parameters common to both streaming and non-streaming calls
 */
function prepareRequestParams(
  prompt: string | Message[],
  options: CallAIOptions,
): {
  apiKey: string;
  model: string;
  endpoint: string;
  requestOptions: RequestInit;
  schemaStrategy: SchemaStrategy;
} {
  // Try multiple sources for the API key: explicit option, keyStore, or environment
  const optionsKey = options.apiKey;
  const keyStoreKey = keyStore().current;
  const windowKey = callAiEnv.CALLAI_API_KEY;

  console.log("[call-ai] API key resolution debug:", {
    optionsApiKey: optionsKey ? `${optionsKey.substring(0, 10)}...${optionsKey.substring(optionsKey.length - 10)}` : optionsKey,
    optionsApiKeyType: typeof optionsKey,
    optionsApiKeyLength: optionsKey?.length,
    keyStoreCurrent: keyStoreKey
      ? `${keyStoreKey.substring(0, 10)}...${keyStoreKey.substring(keyStoreKey.length - 10)}`
      : keyStoreKey,
    keyStoreType: typeof keyStoreKey,
    windowGlobal: windowKey ? `${windowKey.substring(0, 10)}...${windowKey.substring(windowKey.length - 10)}` : windowKey,
    windowType: typeof windowKey,
    model: options.model,
    endpoint: options.endpoint || "default",
  });

  const apiKey = options.apiKey || keyStore().current || callAiEnv.CALLAI_API_KEY;

  console.log("[call-ai] Resolved API key:", {
    source: options.apiKey ? "options.apiKey" : keyStore().current ? "keyStore" : "window.CALLAI_API_KEY",
    token: apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}` : apiKey,
    tokenLength: apiKey?.length,
  });

  if (!apiKey) {
    throw new CallAIError({
      message: "API key is required",
      status: 401,
      errorType: "authentication_error",
    });
  }
  const schema = options.schema || null;

  // If no API key exists, we won't throw immediately. We'll continue and let handleApiError
  // attempt to fetch a key if needed. This will be handled later in the call chain.

  // Select the appropriate strategy based on model and schema
  const schemaStrategy = chooseSchemaStrategy(options.model, schema);
  const model = schemaStrategy.model;

  // Get custom chat API origin if set
  const customChatOrigin = options.chatUrl || callAiEnv.def.CALLAI_CHAT_URL || null;
  // (typeof window !== "undefined" ? (window as any).CALLAI_CHAT_URL : null) ||
  // (typeof process !== "undefined" && process.env
  //   ? process.env.CALLAI_CHAT_URL
  //   : null);

  // Use custom origin or default OpenRouter URL
  const endpoint =
    options.endpoint ||
    (customChatOrigin
      ? joinUrlParts(customChatOrigin, "/api/v1/chat/completions")
      : "https://openrouter.ai/api/v1/chat/completions");

  // Handle both string prompts and message arrays for backward compatibility
  const messages: Message[] = Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }];

  // Common parameters for both streaming and non-streaming
  const requestParams: Record<string, unknown> = {
    model,
    messages,
    stream: options.stream !== undefined ? options.stream : false,
    provider: {
      sort: "latency",
    },
  };

  // Only include temperature if explicitly set
  if (options.temperature !== undefined) {
    requestParams.temperature = options.temperature;
  }

  // Only include top_p if explicitly set
  if (options.topP !== undefined) {
    requestParams.top_p = options.topP;
  }

  // Only include max_tokens if explicitly set
  if (options.maxTokens !== undefined) {
    requestParams.max_tokens = options.maxTokens;
  }

  // Add optional parameters if specified
  if (options.stop) {
    // Handle both single string and array of stop sequences
    requestParams.stop = Array.isArray(options.stop) ? options.stop : [options.stop];
  }

  // Add response_format parameter for models that support JSON output
  if (options.responseFormat === "json") {
    requestParams.response_format = { type: "json_object" };
  }

  // Add schema structure if provided (for function calling/JSON mode)
  if (schema) {
    // Apply schema-specific parameters using the selected strategy
    Object.assign(requestParams, schemaStrategy.prepareRequest(schema, messages));
  }

  // HTTP headers for the request (normalize to `Headers` and merge caller headers)
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": options.referer || "https://vibes.diy",
    "X-Title": options.title || "Vibes",
  });

  if (options.headers) {
    const extra = new Headers(options.headers as HeadersInit);
    extra.forEach((value, key) => headers.set(key, value));
  }

  // Build the requestOptions object for fetch
  const requestOptions: RequestInit = {
    method: "POST",
    headers, // pass a real Headers instance
    body: JSON.stringify(requestParams),
  };

  // If we don't have an API key, throw a clear error that can be caught and handled
  // by the error handling system to trigger key fetching
  if (!apiKey) {
    throw new Error("API key is required. Provide it via options.apiKey or set window.CALLAI_API_KEY");
  }

  // Debug logging for request payload
  if (options.debug) {
    console.log(`[callAi-prepareRequest:raw] Endpoint: ${endpoint}`);
    console.log(`[callAi-prepareRequest:raw] Model: ${model}`);
    console.log(`[callAi-prepareRequest:raw] Payload:`, JSON.stringify(requestParams));
  }

  return { apiKey, model, endpoint, requestOptions, schemaStrategy };
}

/**
 * Internal implementation for non-streaming API calls
 */
async function callAINonStreaming(prompt: string | Message[], options: CallAIOptions = {}, isRetry = false): Promise<string> {
  try {
    // Start timing for metadata
    const startTime = Date.now();

    // Create metadata object
    const meta: ResponseMeta = {
      model: options.model || "unknown",
      timing: {
        startTime: startTime,
      },
    };
    const { endpoint, requestOptions, model, schemaStrategy } = prepareRequestParams(prompt, options);

    const response = await callAiFetch(options)(endpoint, requestOptions);

    // We don't store the raw Response object in metadata anymore

    // Handle HTTP errors, with potential fallback for invalid model
    if (!response.ok || response.status >= 400) {
      const { isInvalidModel } = await checkForInvalidModelError(response, model, options.debug);

      if (isInvalidModel && !options.skipRetry) {
        // Retry with fallback model
        return callAINonStreaming(prompt, { ...options, model: FALLBACK_MODEL }, true);
      }

      // Create a proper error object with the status code preserved
      const error = new CallAIError({
        message: `HTTP error! Status: ${response.status}`,
        status: response.status,
        statusCode: response.status,
        contentType: "text/plain",
      });
      // Add status code as a property of the error object
      // error.status = response.status;
      // error.statusCode = response.status; // Add statusCode for compatibility with different error patterns
      throw error;
    }

    let result: APIResponse;

    // For Claude, use text() instead of json() to avoid potential hanging
    if (/claude/i.test(model)) {
      try {
        result = (await extractClaudeResponse(response)) as APIResponse;
      } catch (error) {
        handleApiError(error, "Claude API response processing failed", options.debug);
        throw error;
      }
    } else {
      result = (await response.json()) as APIResponse;
    }

    // Debug logging for raw API response
    if (options.debug) {
      console.log(`[callAi-nonStreaming:raw] Response:`, JSON.stringify(result));
    }

    // Handle error responses
    if (result.error) {
      if (options.debug) {
        console.error("API returned an error:", result.error);
      }
      // If it's a model error and not already a retry, try with fallback
      const errorMessage = typeof result.error === "string" ? result.error : result.error.message;
      if (!isRetry && !options.skipRetry && errorMessage && errorMessage.toLowerCase().includes("not a valid model")) {
        if (options.debug) {
          console.warn(`Model ${model} error, retrying with ${FALLBACK_MODEL}`);
        }
        return callAINonStreaming(prompt, { ...options, model: FALLBACK_MODEL }, true);
      }
      return JSON.stringify({
        error: result.error,
        message: errorMessage || "API returned an error",
      });
    }

    // Extract content from the response
    const content = extractContent(result as AIResult, schemaStrategy);

    // Store the raw response data for user access
    if (result) {
      // Store the parsed JSON result from the API call
      meta.rawResponse = result as string | ModelId;
    }

    // Update model info
    meta.model = model;

    // Update timing info
    if (meta.timing) {
      meta.timing.endTime = Date.now();
      meta.timing.duration = meta.timing.endTime - meta.timing.startTime;
    }

    // Process the content based on model type
    const processedContent = schemaStrategy.processResponse(content);

    // Box the string for WeakMap storage
    const boxed = boxString(processedContent);
    responseMetadata.set(boxed, meta);

    return processedContent;
  } catch (error) {
    await handleApiError(error, "Non-streaming API call", options.debug, {
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      skipRefresh: options.skipRefresh,
      refreshToken: options.refreshToken,
      updateRefreshToken: options.updateRefreshToken,
    });
    // If we get here, key was refreshed successfully, retry the operation with the new key
    // Retry with the refreshed key
    return callAINonStreaming(
      prompt,
      {
        ...options,
        apiKey: keyStore().current, // Use the refreshed key from keyStore
      },
      true,
    ); // Set isRetry to true
  }

  // This line will never be reached, but it satisfies the linter
  throw new Error("Unexpected code path in callAINonStreaming");
}
