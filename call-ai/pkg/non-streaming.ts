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
  APIResponse,
} from "./types.js";
import { globalDebug, keyStore, initKeyStore } from "./key-management.js";
import { handleApiError, checkForInvalidModelError } from "./error-handling.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { PACKAGE_VERSION } from "./version.js";
import { callAiFetch } from "./utils.js";

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

  // Copy any other options not explicitly handled above
  Object.keys(options).forEach((key) => {
    if (
      ![
        "apiKey",
        "model",
        "endpoint",
        "stream",
        "schema",
        "maxTokens",
        "temperature",
        "topP",
        "responseFormat",
        "referer",
        "title",
        "headers",
        "skipRefresh",
        "debug",
      ].includes(key)
    ) {
      requestBody[key] = options[key];
    }
  });

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

    // Parse response
    let result;
    try {
      // For special cases like Claude, use a different extraction method
      if (/claude/.test(model)) {
        result = await extractClaudeResponse(response);
      } else {
        const json = (await response.json()) as AIResult;
        result = extractContent(json, schemaStrategy);
      }
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

// Extract content from API response accounting for different formats
function extractContent(result: AIResult, schemaStrategy: SchemaStrategy): string {
  // Debug output has been removed for brevity

  if (!result) {
    return "";
  }

  // Handle different response formats
  if (result.choices && result.choices.length > 0) {
    const choice = result.choices[0];

    // Handle OpenAI format - content directly in message
    if (choice.message && choice.message.content) {
      return schemaStrategy.processResponse(choice.message.content);
    }

    // Handle function call response - pass through the schemaStrategy
    if (choice.message && choice.message.function_call) {
      return schemaStrategy.processResponse(choice.message.function_call);
    }

    // Handle function/tools response (newer format)
    if (choice.message && choice.message.tool_calls) {
      return schemaStrategy.processResponse(choice.message.tool_calls);
    }

    // Handle anthropic/claude format with content blocks
    if (choice.message && Array.isArray(choice.message.content)) {
      let textContent = "";
      let toolUse = null;

      // Find text or tool_use blocks
      for (const block of choice.message.content) {
        if (block.type === "text") {
          textContent += block.text || "";
        } else if (block.type === "tool_use") {
          toolUse = block;
          break; // We found what we need
        }
      }

      // If we have a tool_use block, that takes precedence
      if (toolUse) {
        return schemaStrategy.processResponse(toolUse);
      }

      // Otherwise use the accumulated text content
      return schemaStrategy.processResponse(textContent);
    }

    // Fallback for simple text response
    if (choice.text) {
      return schemaStrategy.processResponse(choice.text);
    }
  }
  if (typeof result !== "string") {
    throw new Error(`Failed to extract content from API response: ${JSON.stringify(result)}`);
  }

  // Return raw result if we couldn't extract content
  return result;
}

// Extract response from Claude API with timeout handling
async function extractClaudeResponse(response: Response): Promise<NonNullable<unknown>> {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout extracting Claude response"));
      }, 5000); // 5 second timeout
    });

    const responsePromise = response.json();

    // Race between timeout and response
    const json = (await Promise.race([responsePromise, timeoutPromise])) as APIResponse;

    if (json.choices && json.choices.length > 0 && json.choices[0].message && json.choices[0].message.content) {
      return json.choices[0].message.content;
    }

    // If content not found in expected structure, return the whole JSON
    return json;
  } catch (error) {
    throw new Error(`Failed to extract Claude response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { callAINonStreaming, extractContent, extractClaudeResponse, PACKAGE_VERSION, FALLBACK_MODEL };
