/**
 * Streaming response handling for call-ai
 */

import {
  CallAIError,
  CallAIOptions,
  Message,
  ResponseMeta,
  SchemaAIMessageRequest,
  SchemaStrategy,
  StreamResponse,
  ThenableStreamResponse,
} from "./types.js";
import { globalDebug } from "./key-management.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { checkForInvalidModelError } from "./error-handling.js";
import { PACKAGE_VERSION, FALLBACK_MODEL } from "./non-streaming.js";
import { detectCodeBlocks } from "./code-block-detector.js";
import { StreamMessage, StreamTypes, nextStreamId } from "./stream-messages.js";

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

/**
 * Step 1: Parse SSE stream and yield raw text content chunks.
 * Handles SSE protocol, JSON parsing, error handling, and tool call assembly.
 */
async function* parseSSE(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is undefined - API endpoint may not support streaming");
  }

  const textDecoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;
  let toolCallsAssembled = "";

  // Helper to process JSON payload and yield text
  // Returns true if content was yielded
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processJson(json: any): string | null {
    // Check for error responses in the stream
    if (
      json.error ||
      json.type === "error" ||
      (json.choices && json.choices.length > 0 && json.choices[0].finish_reason === "error")
    ) {
      const errorMessage = json.error?.message || json.error || json.choices?.[0]?.message?.content || "Unknown streaming error";

      const detailedError = new CallAIError({
        message: `API streaming error: ${errorMessage}`,
        status: json.error?.status || 400,
        statusText: json.error?.type || "Bad Request",
        details: JSON.stringify(json.error || json),
        contentType: "application/json",
      });
      throw detailedError;
    }

    // Handle tool use response - Claude with schema cases
    const isClaudeWithSchema = /claude/i.test(model) && schemaStrategy.strategy === "tool_mode";

    if (isClaudeWithSchema) {
      if (json.choices && json.choices.length > 0) {
        const choice = json.choices[0];

        // Handle finish reason tool_calls
        if (choice.finish_reason === "tool_calls") {
          if (toolCallsAssembled) {
            try {
              // Try to fix any malformed JSON from chunking
              let fixedJson = toolCallsAssembled;
              try {
                JSON.parse(toolCallsAssembled);
              } catch (parseError) {
                // Apply fixes (same logic as before)
                // eslint-disable-next-line no-useless-escape
                fixedJson = fixedJson.replace(/,\s*([\}\]])/, "$1");
                const openBraces = (fixedJson.match(/\{/g) || []).length;
                const closeBraces = (fixedJson.match(/\}/g) || []).length;
                if (openBraces > closeBraces) fixedJson += "}".repeat(openBraces - closeBraces);
                if (!fixedJson.trim().startsWith("{")) fixedJson = "{" + fixedJson.trim();
                if (!fixedJson.trim().endsWith("}")) fixedJson += "}";
                fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*$/g, '"$1":null');
                fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*,/g, '"$1":null,');
                fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*"(\w+)/g, '"$1$2"');
                const openBrackets = (fixedJson.match(/\[/g) || []).length;
                const closeBrackets = (fixedJson.match(/\]/g) || []).length;
                if (openBrackets > closeBrackets) fixedJson += "]".repeat(openBrackets - closeBrackets);

                toolCallsAssembled = fixedJson;
              }
              // Return the assembled tool call
              return toolCallsAssembled;
            } catch (e) {
              console.error("[parseSSE] Error handling assembled tool call:", e);
            }
          }
        }

        // Assemble tool_calls arguments from delta
        if (choice && choice.delta && choice.delta.tool_calls) {
          const toolCall = choice.delta.tool_calls[0];
          if (toolCall && toolCall.function && toolCall.function.arguments !== undefined) {
            toolCallsAssembled += toolCall.function.arguments;
          }
        }
      }
    }

    // Handle tool use response - old format
    if (isClaudeWithSchema && (json.stop_reason === "tool_use" || json.type === "tool_use")) {
      if (json.type === "tool_use") return schemaStrategy.processResponse(json);

      if (json.content && Array.isArray(json.content)) {
        const toolUseBlock = json.content.find((block: { type: string }) => block.type === "tool_use");
        if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
      }

      if (json.choices && Array.isArray(json.choices)) {
        const choice = json.choices[0];
        if (choice.message && Array.isArray(choice.message.content)) {
          const toolUseBlock = choice.message.content.find((block: { type: string }) => block.type === "tool_use");
          if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
        }
        if (choice.delta && Array.isArray(choice.delta.content)) {
          const toolUseBlock = choice.delta.content.find((block: { type: string }) => block.type === "tool_use");
          if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
        }
      }
    }

    // Extract content from delta
    if (json.choices?.[0]?.delta?.content !== undefined) {
      const content = json.choices[0].delta.content || "";
      return content;
    }
    // Handle message content format (non-streaming deltas)
    else if (json.choices?.[0]?.message?.content !== undefined) {
      const content = json.choices[0].message.content || "";
      return schemaStrategy.processResponse(content);
    }
    // Handle content blocks for Claude/Anthropic response format
    else if (json.choices?.[0]?.message?.content && Array.isArray(json.choices[0].message.content)) {
      const contentBlocks = json.choices[0].message.content;
      let blockDelta = "";
      for (const block of contentBlocks) {
        if (block.type === "text") {
          blockDelta += block.text || "";
        } else if (isClaudeWithSchema && block.type === "tool_use") {
          return schemaStrategy.processResponse(block);
        }
      }
      return blockDelta;
    }

    // Find text delta for content blocks (Claude format)
    if (json.type === "content_block_delta" && json.delta && json.delta.type === "text_delta" && json.delta.text) {
      if (options.debug) {
        console.log(`[callAi:${PACKAGE_VERSION}] Received text delta:`, json.delta.text);
      }
      if (!isClaudeWithSchema) {
        return json.delta.text; // Return text directly
      }
    }

    return null;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (options.debug || globalDebug) {
          console.log(`[callAi-streaming:complete v${PACKAGE_VERSION}] Stream finished after ${chunkCount} chunks`);
        }
        break;
      }

      const chunk = textDecoder.decode(value, { stream: true });
      buffer += chunk;
      const messages = buffer.split(/\n\n/);
      buffer = messages.pop() || "";

      for (const message of messages) {
        if (!message.trim() || !message.startsWith("data: ")) continue;

        const jsonStr = message.slice(6);
        if (jsonStr === "[DONE]") continue;

        chunkCount++;

        try {
          const json = JSON.parse(jsonStr);
          const content = processJson(json);
          if (content !== null && content.length > 0) {
            yield content;
          }
        } catch (e) {
          if (e instanceof CallAIError) throw e;
          if (options.debug) console.error(`[callAIStreaming] Error parsing JSON chunk:`, e);
        }
      }
    }

    // Final assembled tool calls
    if (toolCallsAssembled) {
      // Fix JSON (simplified for final check)
      let result = toolCallsAssembled;
      try {
        JSON.parse(result);
      } catch (e) {
        // Apply robust fixes
        // eslint-disable-next-line no-useless-escape
        result = result.replace(/,\s*([\}\]])/, "$1");
        const openBraces = (result.match(/\{/g) || []).length;
        const closeBraces = (result.match(/\}/g) || []).length;
        if (openBraces > closeBraces) result += "}".repeat(openBraces - closeBraces);
        if (!result.trim().startsWith("{")) result = "{" + result.trim();
        if (!result.trim().endsWith("}")) result += "}";
        result = result.replace(/"(\w+)"\s*:\s*$/g, '"$1":null');
        result = result.replace(/"(\w+)"\s*:\s*,/g, '"$1":null,');
        const openBrackets = (result.match(/\[/g) || []).length;
        const closeBrackets = (result.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) result += "]".repeat(openBrackets - closeBrackets);

        toolCallsAssembled = result;
      }
      yield toolCallsAssembled;
    }
  } catch (error) {
    if (options.debug || globalDebug) {
      console.error(`[callAi:${PACKAGE_VERSION}] Streaming error:`, error);
    }
    throw error;
  }
}

// Step 2: Core Semantic Generator
// Composes parseSSE -> detectCodeBlocks
async function* createSemanticGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<StreamMessage, void, unknown> {
  const streamId = nextStreamId();
  const sseStream = parseSSE(response, options, schemaStrategy, model);

  // Pipeline: SSE Stream -> Code Block Detector -> Semantic Events
  yield* detectCodeBlocks(sseStream, streamId, model);
}

// Wrapper function that selects the right output format based on options
async function* createStreamingGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string | StreamMessage, string, unknown> {
  const semanticMode = (options as { _semanticMode?: boolean })._semanticMode ?? false;

  // Create metadata for this streaming response
  const meta: ResponseMeta = {
    model,
    endpoint: options.endpoint || "https://openrouter.ai/api/v1",
    timing: {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
    },
  };

  // Create the semantic generator pipeline
  const semanticGen = createSemanticGenerator(response, options, schemaStrategy, model);

  if (semanticMode) {
    // Return events directly (no metadata storage for semantic mode)
    yield* semanticGen;
  } else {
    // Default: accumulate text (legacy mode) with metadata tracking
    let accumulated = "";
    for await (const msg of semanticGen) {
      if (msg.type === StreamTypes.TEXT_FRAGMENT || msg.type === StreamTypes.CODE_FRAGMENT) {
        accumulated += (msg.payload as { frag: string }).frag;
        yield schemaStrategy.processResponse(accumulated);
      }
    }

    // Update timing
    const endTime = Date.now();
    meta.timing.endTime = endTime;
    meta.timing.duration = endTime - meta.timing.startTime;
    meta.rawResponse = accumulated;

    // Store metadata for getMeta() retrieval
    const boxed = boxString(accumulated);
    responseMetadata.set(boxed, meta);

    return accumulated;
  }
  return "";
}

// Simplified generator for accessing streaming results
// Returns an async generator that yields blocks of text
// This is a higher-level function that prepares the request
// and handles model fallback
//
// Note: When _semanticMode is true, this actually yields StreamMessage objects
// but we keep the return type as string for public API compatibility.
// Internal callers (callAIStreamingSemantic) cast appropriately.
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
        "_semanticMode", // Internal option, not sent to API
      ].includes(key)
    ) {
      requestBody[key] = (options as Record<string, unknown>)[key];
    }
  });

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

    // Yield streaming results through the generator
    // Cast is safe: in normal mode yields strings, in _semanticMode yields StreamMessage
    // but callAIStreamingSemantic handles the casting on its end
    yield* createStreamingGenerator(response, options, schemaStrategy, model) as AsyncGenerator<string, string, unknown>;

    // The createStreamingGenerator will return the final assembled string
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

/**
 * Internal function that wraps callAIStreaming and yields StreamMessage events.
 * Used by parseAIStream to get semantic events directly without double-processing.
 * This is not part of the public API.
 *
 * Uses _semanticMode to get StreamMessage events directly from createStreamingGenerator,
 * which uses detectCodeBlocks to process all content.
 */
async function* callAIStreamingSemantic(
  prompt: string | Message[],
  options: CallAIOptions,
): AsyncGenerator<StreamMessage, void, unknown> {
  // Use _semanticMode to get StreamMessage events directly from the single detector
  // Cast is necessary because callAIStreaming's public type is string, but in _semanticMode
  // it actually yields StreamMessage objects
  const semanticStream = callAIStreaming(prompt, {
    ...options,
    _semanticMode: true,
  } as CallAIOptions & { _semanticMode: boolean }) as unknown as AsyncGenerator<StreamMessage, string, unknown>;

  for await (const event of semanticStream) {
    yield event;
  }
}

export { createStreamingGenerator, callAIStreaming, callAIStreamingSemantic };
