/**
 * Streaming response handling for call-ai
 */

import {
  CallAIOptions,
  Message,
  SchemaAIMessageRequest,
  StreamResponse,
  ThenableStreamResponse,
} from "./types.js";
import { globalDebug } from "./key-management.js";
import { checkForInvalidModelError } from "./error-handling.js";
import { copyPassthroughOptions } from "./utils.js";
import { PACKAGE_VERSION, FALLBACK_MODEL } from "./non-streaming.js";
import { createSchemaStreamingGenerator } from "./schema-streaming.js";
import { createTextStreamingGenerator } from "./text-streaming.js";

/**
 * Create a proxy that acts both as a Promise and an AsyncGenerator for backward compatibility
 * Moved from api-core.ts
 */
export function createBackwardCompatStreamingProxy<T>(promise: Promise<StreamResponse<T>>): ThenableStreamResponse<T> {
  // Create a proxy that forwards methods to the Promise or AsyncGenerator as appropriate
  return new Proxy({} as ThenableStreamResponse<T>, {
    get(_target, prop) {
      // First check if it's an AsyncGenerator method (needed for for-await)
      if (prop === "next" || prop === "throw" || prop === "return" || prop === Symbol.asyncIterator) {
        // Create wrapper functions that await the Promise first
        if (prop === Symbol.asyncIterator) {
          return function () {
            return {
              // Implement async iterator that gets the generator first
              async next(value: unknown) {
                try {
                  const generator = await promise;
                  return generator.next(value);
                } catch (error) {
                  // Turn Promise rejection into iterator result with error thrown
                  return Promise.reject(error);
                }
              },
            };
          };
        }

        // Methods like next, throw, return
        return async function (value: unknown) {
          const generator = await promise;
          switch (prop) {
            case "next":
              return generator.next(value);
            case "throw":
              return generator.throw(value);
            case "return":
              return generator.return(value as string);
            default:
              throw new Error(`Unknown method: ${String(prop)}`);
          }
        };
      }

      // Then check if it's a Promise method
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return promise[prop].bind(promise);
      }

      return undefined;
    },
  });
}

// Simplified generator for accessing streaming results
// Returns an async generator that yields blocks of text
// This is a higher-level function that prepares the request
// and handles model fallback
async function* callAIStreaming(
  prompt: string | Message[],
  options: CallAIOptions = {},
  isRetry = false,
): AsyncGenerator<string, string, unknown> {
  // Convert simple string prompts to message array format
  const messages = Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt } as Message];

  // API key should be provided by options (validation happens in callAi)
  const apiKey = options.apiKey;
  const model = options.model || "openai/gpt-3.5-turbo";

  // Default endpoint compatible with OpenAI API
  const endpoint = options.endpoint || "https://openrouter.ai/api/v1";

  // Build the endpoint URL
  const url = `${endpoint}/chat/completions`;

  // Choose a schema strategy based on model
  const schemaStrategy = options.schemaStrategy;

  // Default to JSON response for certain models
  const responseFormat = options.responseFormat || /gpt-4/.test(model) || /gpt-3.5/.test(model) ? "json" : undefined;

  const debug = options.debug === undefined ? globalDebug : options.debug;

  if (debug) {
    console.log(`[callAi:${PACKAGE_VERSION}] Making streaming request to: ${url}`);
    console.log(`[callAi:${PACKAGE_VERSION}] With model: ${model}`);
  }

  // Build request body
  const requestBody: SchemaAIMessageRequest = {
    model,
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    top_p: options.topP !== undefined ? options.topP : 1,
    stream: true,
  };

  // Add response_format if specified or for JSON handling
  if (responseFormat === "json") {
    requestBody.response_format = { type: "json_object" };
  }

  // Add schema-specific parameters (if schema is provided)
  if (options.schema) {
    Object.assign(requestBody, schemaStrategy?.prepareRequest(options.schema, messages));
  }

  // Add HTTP referer and other options to help with abuse prevention
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": options.referer || "https://vibes.diy",
    "X-Title": options.title || "Vibes",
    "Content-Type": "application/json",
  };

  // Add any additional headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // Copy passthrough options (provider-specific params like tools, tool_choice, etc.)
  copyPassthroughOptions(options as Record<string, unknown>, requestBody);

  if (debug) {
    console.log(`[callAi:${PACKAGE_VERSION}] Request headers:`, headers);
    console.log(`[callAi:${PACKAGE_VERSION}] Request body:`, requestBody);
  }

  let response;
  try {
    // Make the API request
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    // Handle HTTP errors
    if (!response.ok) {
      // Check if this is an invalid model error that we can handle with a fallback
      const { isInvalidModel, errorData } = await checkForInvalidModelError(response, model, debug);

      if (isInvalidModel && !isRetry && !options.skipRetry) {
        if (debug) {
          console.log(`[callAi:${PACKAGE_VERSION}] Invalid model "${model}", falling back to "${FALLBACK_MODEL}"`);
        }

        // Retry with the fallback model using yield* to delegate to the other generator
        yield* callAIStreaming(
          prompt,
          {
            ...options,
            model: FALLBACK_MODEL,
          },
          true, // Mark as retry to prevent infinite fallback loops
        );

        // Generator delegation handles returning the final value
        return "";
      }

      // For other errors, throw with details
      const errorText = errorData ? JSON.stringify(errorData) : `HTTP error! Status: ${response.status}`;
      throw new Error(errorText);
    }
    if (!schemaStrategy) {
      throw new Error("Schema strategy is required for streaming");
    }

    // Use parser-based streaming for all responses
    if (schemaStrategy.strategy === "tool_mode") {
      yield* createSchemaStreamingGenerator(response, options, schemaStrategy, model);
    } else {
      yield* createTextStreamingGenerator(response, options, schemaStrategy, model);
    }

    // The generators will return the final assembled string
    return ""; // This is never reached due to yield*
  } catch (fetchError) {
    // Network errors must be directly re-thrown without modification
    // This is exactly how the original implementation handles it
    if (debug) {
      console.error(`[callAi:${PACKAGE_VERSION}] Network error during fetch:`, fetchError);
    }
    // Critical: throw the exact same error object without any wrapping
    throw fetchError;
  }
}

export { callAIStreaming };
