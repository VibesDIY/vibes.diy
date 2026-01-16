/**
 * Non-streaming API call implementation for call-ai
 */
import {
  AIResult,
  CallAIErrorParams,
  CallAIOptions,
  Message,
  SchemaAIMessageRequest,
  SchemaStrategy,
} from "./types.js";
import { globalDebug, keyStore, initKeyStore } from "./key-management.js";
import { handleApiError, checkForInvalidModelError } from "./error-handling.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { PACKAGE_VERSION } from "./version.js";
import { callAiFetch, copyPassthroughOptions } from "./utils.js";
import { NonStreamingOpenRouterParser } from "./parser/non-streaming-openrouter-parser.js";

// Import package version for debugging
const FALLBACK_MODEL = "openrouter/auto";

// Internal implementation for non-streaming API calls
async function callAINonStreaming(prompt: string | Message[], options: CallAIOptions = {}, isRetry = false): Promise<string> {
  // Ensure keyStore is initialized first
  initKeyStore();

  // Convert simple string prompts to message array format
  const messages = Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt } satisfies Message];

  // API key should be provided by options (validation happens in callAi)
  const apiKey = options.apiKey;
  const model = options.model || "openai/gpt-3.5-turbo";

  // Default endpoint compatible with OpenAI API
  const endpoint = options.endpoint || "https://openrouter.ai/api/v1";

  // Build the endpoint URL
  const url = `${endpoint}/chat/completions`;

  // Choose a schema strategy based on model
  const schemaStrategy = options.schemaStrategy;
  if (!schemaStrategy) {
    throw new Error("Schema strategy is required for non-streaming calls");
  }

  // Default to JSON response for certain models
  const responseFormat = options.responseFormat || /gpt-4/.test(model) || /gpt-3.5/.test(model) ? "json" : undefined;

  const debug = options.debug === undefined ? globalDebug : options.debug;

  if (debug) {
    console.log(`[callAi:${PACKAGE_VERSION}] Making non-streaming request to: ${url}`);
    console.log(`[callAi:${PACKAGE_VERSION}] With model: ${model}`);
  }

  // Build request body
  const requestBody: SchemaAIMessageRequest = {
    model,
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    top_p: options.topP !== undefined ? options.topP : 1,
    stream: false,
  };

  // Add response_format if specified or for JSON handling
  if (responseFormat === "json") {
    requestBody.response_format = { type: "json_object" };
  }

  // Add schema-specific parameters (if schema is provided)
  if (options.schema) {
    Object.assign(requestBody, schemaStrategy.prepareRequest(options.schema, messages));
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

  // Create metadata object for this response
  const meta = {
    model,
    endpoint,
    timing: {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
    },
  };

  try {
    // Make the API request - matching original implementation structure
    const response = await callAiFetch(options)(url, {
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

        // Retry with the fallback model
        return callAINonStreaming(
          prompt,
          {
            ...options,
            model: FALLBACK_MODEL,
          },
          true, // Mark as retry to prevent infinite fallback loops
        );
      }

      // For other errors, throw with details
      const errorText = errorData ? JSON.stringify(errorData) : `HTTP error! Status: ${response.status}`;
      throw new Error(errorText);
    }

    // Parse response using the parser
    let result;
    try {
      const json = (await response.json()) as AIResult;

      // Extract content using the parser
      const parser = new NonStreamingOpenRouterParser();
      let content = "";
      parser.onEvent((evt) => {
        if (evt.type === "or.delta") {
          content = evt.content;
        }
      });
      parser.parse(json);

      // Process the content through the strategy
      result = schemaStrategy.processResponse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Update metadata with completion timing
    const endTime = Date.now();
    meta.timing.endTime = endTime;
    meta.timing.duration = endTime - meta.timing.startTime;

    // Store metadata for this response
    const resultString = typeof result === "string" ? result : JSON.stringify(result);

    // Box the string for WeakMap storage
    const boxed = boxString(resultString);
    responseMetadata.set(boxed, meta);

    return resultString;
  } catch (error) {
    // Check if this is a network/fetch error
    const isNetworkError = error instanceof Error && (error.message.includes("Network") || error.name === "TypeError");

    if (isNetworkError) {
      // Direct re-throw for network errors (original implementation pattern)
      if (debug) {
        console.error(`[callAi:${PACKAGE_VERSION}] Network error during fetch:`, error);
      }
      throw error;
    }

    // For other errors, use API error handling
    await handleApiError(error as CallAIErrorParams, "Non-streaming API call", options.debug, {
      apiKey: apiKey || undefined,
      endpoint: options.endpoint || undefined,
      skipRefresh: options.skipRefresh,
    });

    // If handleApiError refreshed the key, we want to retry with the new key
    if (keyStore().current && keyStore().current !== apiKey) {
      if (debug) {
        console.log(`[callAi:${PACKAGE_VERSION}] Retrying with refreshed API key`);
      }

      // Retry the request with the new key
      return callAINonStreaming(
        prompt,
        {
          ...options,
          apiKey: keyStore().current,
        },
        isRetry, // Preserve retry status
      );
    }

    // If we get here, handleApiError failed to recover, so we should never reach this
    // But just in case, rethrow the error
    throw error;
  }
}

export { callAINonStreaming, PACKAGE_VERSION, FALLBACK_MODEL };
