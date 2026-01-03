/**
 * Streaming response handling for call-ai
 */

import { CallAIError, CallAIOptions, Message, ResponseMeta, SchemaAIMessageRequest, SchemaStrategy, StreamResponse, ThenableStreamResponse } from "./types.js";
import { globalDebug } from "./key-management.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { checkForInvalidModelError } from "./error-handling.js";
import { PACKAGE_VERSION, FALLBACK_MODEL } from "./non-streaming.js";
import { CodeBlockDetector } from "./code-block-detector.js";
import { StreamMessage, StreamTypes, nextStreamId } from "./stream-messages.js";

// Adapter to accumulate text from semantic stream (for default stream: true)
async function* accumulateTextFromSemantic(
  semanticGen: AsyncGenerator<StreamMessage, void, unknown>,
  schemaStrategy: SchemaStrategy,
): AsyncGenerator<string, string, unknown> {
  let accumulated = "";
  for await (const msg of semanticGen) {
    if (msg.type === StreamTypes.TEXT_FRAGMENT || msg.type === StreamTypes.CODE_FRAGMENT) {
      accumulated += (msg.payload as { frag: string }).frag;
      yield schemaStrategy.processResponse(accumulated);
    }
  }
  return accumulated;
}

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

// Internal generator that ALWAYS yields StreamMessage events
// This is the core implementation that processes the raw API response
async function* createSemanticGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<StreamMessage, void, unknown> {
  // Create a metadata object for this streaming response
  const meta: ResponseMeta = {
    model,
    endpoint: options.endpoint || "https://openrouter.ai/api/v1",
    timing: {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
    },
  };

  // Tool calls assembly (for Claude/Anthropic)
  let toolCallsAssembled = "";
  let completeText = "";
  let chunkCount = 0;

  // Code block detector for semantic parsing
  const detector = new CodeBlockDetector(model);
  const streamId = nextStreamId();
  let seqCounter = 0;

  // Helper to process content through detector and yield appropriately
  const processAndYield = function* (content: string, isToolCallResult = false): Generator<StreamMessage, void, unknown> {
    if (!content) return;

    // Tool call results bypass detector (they're JSON, not markdown)
    if (isToolCallResult) {
      yield {
        type: StreamTypes.TEXT_FRAGMENT,
        src: model,
        dst: "client",
        ttl: 1,
        payload: { streamId, seq: String(seqCounter++), frag: content },
      } as StreamMessage;
      return;
    }

    // Route through CodeBlockDetector for semantic parsing
    const events = detector.feed(content, streamId, seqCounter++);
    for (const event of events) {
      yield event;
    }
  };

  if (options.debug || globalDebug) {
    console.log(`[callAi:${PACKAGE_VERSION}] Starting semantic generator with model: ${model}`);
  }

  try {
    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is undefined - API endpoint may not support streaming");
    }

    const textDecoder = new TextDecoder();
    let buffer = ""; // Buffer to accumulate partial SSE messages

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (options.debug || globalDebug) {
          console.log(`[callAi-streaming:complete v${PACKAGE_VERSION}] Stream finished after ${chunkCount} chunks`);
        }
        break;
      }

      // Convert bytes to text
      const chunk = textDecoder.decode(value, { stream: true });
      buffer += chunk;

      // Split on double newlines to find complete SSE messages
      const messages = buffer.split(/\n\n/);
      buffer = messages.pop() || ""; // Keep the last incomplete chunk in the buffer

      for (const message of messages) {
        if (!message.trim() || !message.startsWith("data: ")) {
          continue; // Skip empty lines or non-data messages
        }

        // Extract the JSON payload
        const jsonStr = message.slice(6); // Remove 'data: ' prefix
        if (jsonStr === "[DONE]") {
          if (options.debug || globalDebug) {
            console.log(`[callAi:${PACKAGE_VERSION}] Received [DONE] signal`);
          }
          continue;
        }

        chunkCount++;

        // Try to parse the JSON
        try {
          const json = JSON.parse(jsonStr);

          // Check for error responses in the stream
          if (
            json.error ||
            json.type === "error" ||
            (json.choices && json.choices.length > 0 && json.choices[0].finish_reason === "error")
          ) {
            // Extract error message
            const errorMessage =
              json.error?.message || json.error || json.choices?.[0]?.message?.content || "Unknown streaming error";

            if (options.debug || globalDebug) {
              console.error(`[callAi:${PACKAGE_VERSION}] Detected error in streaming response:`, json);
            }

            // Create a detailed error to throw
            const detailedError = new CallAIError({
              message: `API streaming error: ${errorMessage}`,
              status: json.error?.status || 400,
              statusText: json.error?.type || "Bad Request",
              details: JSON.stringify(json.error || json),
              contentType: "application/json",
            }); // Add error metadata

            console.error(`[callAi:${PACKAGE_VERSION}] Throwing stream error:`, detailedError);
            throw detailedError;
          }

          // Handle tool use response - Claude with schema cases
          const isClaudeWithSchema = /claude/i.test(model) && schemaStrategy.strategy === "tool_mode";

          if (isClaudeWithSchema) {
            // Claude streaming tool calls - need to assemble arguments
            if (json.choices && json.choices.length > 0) {
              const choice = json.choices[0];

              // Handle finish reason tool_calls - this is where we know the tool call is complete
              if (choice.finish_reason === "tool_calls") {
                if (options.debug) {
                  console.log(`[callAi:${PACKAGE_VERSION}] Received tool_calls finish reason. Assembled JSON:`, toolCallsAssembled);
                }

                // Full JSON collected, construct a proper object with it
                try {
                  // Try to fix any malformed JSON that might have resulted from chunking
                  // This happens when property names get split across chunks
                  if (toolCallsAssembled) {
                    try {
                      // First try parsing as-is
                      JSON.parse(toolCallsAssembled);
                    } catch (parseError) {
                      if (options.debug) {
                        console.log(
                          `[callAi:${PACKAGE_VERSION}] Attempting to fix malformed JSON in tool call:`,
                          toolCallsAssembled,
                        );
                      }

                      // Apply comprehensive fixes for Claude's JSON property splitting
                      let fixedJson = toolCallsAssembled;

                      // 1. Remove trailing commas
                      // eslint-disable-next-line no-useless-escape
                      fixedJson = fixedJson.replace(/,\s*([\}\]])/, "$1");

                      // 2. Ensure proper JSON structure
                      // Add closing braces if missing
                      const openBraces = (fixedJson.match(/\{/g) || []).length;
                      const closeBraces = (fixedJson.match(/\}/g) || []).length;
                      if (openBraces > closeBraces) {
                        fixedJson += "}".repeat(openBraces - closeBraces);
                      }

                      // Add opening brace if missing
                      if (!fixedJson.trim().startsWith("{")) {
                        fixedJson = "{" + fixedJson.trim();
                      }

                      // Ensure it ends with a closing brace
                      if (!fixedJson.trim().endsWith("}")) {
                        fixedJson += "}";
                      }

                      // 3. Fix various property name/value split issues
                      // Fix dangling property names without values
                      fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*$/g, '"$1":null');

                      // Fix missing property values
                      fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*,/g, '"$1":null,');

                      // Fix incomplete property names (when split across chunks)
                      fixedJson = fixedJson.replace(/"(\w+)"\s*:\s*"(\w+)$/g, '"$1$2"');

                      // Balance brackets
                      const openBrackets = (fixedJson.match(/\[/g) || []).length;
                      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
                      if (openBrackets > closeBrackets) {
                        fixedJson += "]".repeat(openBrackets - closeBrackets);
                      }

                      if (options.debug) {
                        console.log(
                          `[callAi:${PACKAGE_VERSION}] Applied comprehensive JSON fixes:`,
                          `\nBefore: ${toolCallsAssembled}`,
                          `\nAfter: ${fixedJson}`,
                        );
                      }

                      toolCallsAssembled = fixedJson;
                    }
                  }

                  // Return the assembled tool call (bypasses detector - it's JSON, not markdown)
                  completeText = toolCallsAssembled;
                  yield* processAndYield(completeText, true);
                  continue;
                } catch (e) {
                  console.error("[callAIStreaming] Error handling assembled tool call:", e);
                }
              }

              // Assemble tool_calls arguments from delta
              // Simply accumulate the raw strings without trying to parse them
              if (choice && choice.delta && choice.delta.tool_calls) {
                const toolCall = choice.delta.tool_calls[0];
                if (toolCall && toolCall.function && toolCall.function.arguments !== undefined) {
                  toolCallsAssembled += toolCall.function.arguments;
                  if (options.debug) {
                    console.log(`[callAi:${PACKAGE_VERSION}] Accumulated tool call chunk:`, toolCall.function.arguments);
                  }
                }
              }
            }
          }

          // Handle tool use response - old format (bypasses detector - it's JSON, not markdown)
          if (isClaudeWithSchema && (json.stop_reason === "tool_use" || json.type === "tool_use")) {
            // First try direct tool use object format
            if (json.type === "tool_use") {
              completeText = schemaStrategy.processResponse(json);
              yield* processAndYield(completeText, true);
              continue;
            }

            // Extract the tool use content
            if (json.content && Array.isArray(json.content)) {
              const toolUseBlock = json.content.find((block: { type: string }) => block.type === "tool_use");
              if (toolUseBlock) {
                completeText = schemaStrategy.processResponse(toolUseBlock);
                yield* processAndYield(completeText, true);
                continue;
              }
            }

            // Find tool_use in assistant's content blocks
            if (json.choices && Array.isArray(json.choices)) {
              const choice = json.choices[0];
              if (choice.message && Array.isArray(choice.message.content)) {
                const toolUseBlock = choice.message.content.find((block: { type: string }) => block.type === "tool_use");
                if (toolUseBlock) {
                  completeText = schemaStrategy.processResponse(toolUseBlock);
                  yield* processAndYield(completeText, true);
                  continue;
                }
              }

              // Handle case where the tool use is in the delta
              if (choice.delta && Array.isArray(choice.delta.content)) {
                const toolUseBlock = choice.delta.content.find((block: { type: string }) => block.type === "tool_use");
                if (toolUseBlock) {
                  completeText = schemaStrategy.processResponse(toolUseBlock);
                  yield* processAndYield(completeText, true);
                  continue;
                }
              }
            }
          }

          // Extract content from the delta
          if (json.choices?.[0]?.delta?.content !== undefined) {
            const content = json.choices[0].delta.content || "";

            // Treat all models the same - yield as content arrives
            completeText += content;
            // Route through CodeBlockDetector for semantic parsing
            yield* processAndYield(content);
          }
          // Handle message content format (non-streaming deltas)
          else if (json.choices?.[0]?.message?.content !== undefined) {
            const content = json.choices[0].message.content || "";
            completeText += content;
            // Route through CodeBlockDetector for semantic parsing
            yield* processAndYield(content);
          }
          // Handle content blocks for Claude/Anthropic response format
          else if (json.choices?.[0]?.message?.content && Array.isArray(json.choices[0].message.content)) {
            const contentBlocks = json.choices[0].message.content;
            // Find text or tool_use blocks
            let blockDelta = "";
            for (const block of contentBlocks) {
              if (block.type === "text") {
                const text = block.text || "";
                completeText += text;
                blockDelta += text;
              } else if (isClaudeWithSchema && block.type === "tool_use") {
                completeText = schemaStrategy.processResponse(block);
                break; // We found what we need
              }
            }

            // Route through CodeBlockDetector for semantic parsing
            yield* processAndYield(blockDelta);
          }

          // Find text delta for content blocks (Claude format)
          if (json.type === "content_block_delta" && json.delta && json.delta.type === "text_delta" && json.delta.text) {
            if (options.debug) {
              console.log(`[callAi:${PACKAGE_VERSION}] Received text delta:`, json.delta.text);
            }
            const textDelta = json.delta.text;
            completeText += textDelta;
            // In some models like Claude, don't yield partial results as they can be malformed JSON
            // Only yield what we've seen so far if it's not a Claude model with schema
            if (!isClaudeWithSchema) {
              // Route through CodeBlockDetector for semantic parsing
              yield* processAndYield(textDelta);
            }
          }
        } catch (e) {
          if (options.debug) {
            console.error(`[callAIStreaming] Error parsing JSON chunk:`, e);
          }
        }
      }
    }

    // If we have assembled tool calls but haven't yielded them yet
    if (toolCallsAssembled && (!completeText || completeText.length === 0)) {
      // Try to fix any remaining JSON issues before returning
      let result = toolCallsAssembled;

      try {
        // Try to parse as-is first
        JSON.parse(result);
      } catch (e) {
        if (options.debug) {
          console.log(`[callAi:${PACKAGE_VERSION}] Final JSON validation failed:`, e, `\nAttempting to fix JSON:`, result);
        }

        // Apply more robust fixes for Claude's streaming JSON issues

        // 1. Remove trailing commas (common in malformed JSON)
        // eslint-disable-next-line no-useless-escape
        result = result.replace(/,\s*([\}\]])/, "$1");

        // 2. Ensure we have proper JSON structure
        // Add closing braces if missing
        const openBraces = (result.match(/\{/g) || []).length;
        const closeBraces = (result.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          result += "}".repeat(openBraces - closeBraces);
        }

        // Add opening brace if missing
        if (!result.trim().startsWith("{")) {
          result = "{" + result.trim();
        }

        // Ensure it ends with a closing brace
        if (!result.trim().endsWith("}")) {
          result += "}";
        }

        // Fix dangling property names without values
        result = result.replace(/"(\w+)"\s*:\s*$/g, '"$1":null');

        // Fix missing property values
        result = result.replace(/"(\w+)"\s*:\s*,/g, '"$1":null,');

        // Balance brackets
        const openBrackets = (result.match(/\[/g) || []).length;
        const closeBrackets = (result.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
          result += "]".repeat(openBrackets - closeBrackets);
        }

        if (options.debug) {
          console.log(`[callAi:${PACKAGE_VERSION}] Applied final JSON fixes:`, result);
        }
      }

      // Return the assembled tool call
      completeText = result;

      // Try one more time to validate
      try {
        JSON.parse(completeText);
      } catch (finalParseError) {
        if (options.debug) {
          console.error(`[callAi:${PACKAGE_VERSION}] Final JSON validation still failed:`, finalParseError);
        }
      }

      // Tool call result bypasses detector - it's JSON, not markdown
      yield* processAndYield(completeText, true);
    }

    // Finalize the detector to flush any remaining buffered content
    const finalEvents = detector.finalize(streamId);
    for (const event of finalEvents) {
      yield event;
    }

    // Record streaming completion in metadata
    const endTime = Date.now();
    meta.timing.endTime = endTime;
    meta.timing.duration = endTime - meta.timing.startTime;

    // Add the rawResponse field to match non-streaming behavior
    // For streaming, we use the final complete text as the raw response
    meta.rawResponse = completeText;

    // Store metadata for this response
    const boxed = boxString(completeText);
    responseMetadata.set(boxed, meta);

    // Return (void in generator, but helpful for types)
  } catch (error) {
    // Streaming generators must properly handle errors
    if (options.debug || globalDebug) {
      console.error(`[callAi:${PACKAGE_VERSION}] Streaming error:`, error);
    }

    // This error will be caught in the caller's try/catch block
    throw error;
  }
}

// Wrapper function that selects the right output format based on options
// This replaces the old createStreamingGenerator
async function* createStreamingGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string | StreamMessage, string, unknown> {
  const semanticMode = (options as { _semanticMode?: boolean })._semanticMode ?? false;

  // Always create the semantic generator
  const semanticGen = createSemanticGenerator(response, options, schemaStrategy, model);

  if (semanticMode) {
    // Return events directly
    yield* semanticGen;
  } else {
    // Default: accumulate text
    yield* accumulateTextFromSemantic(semanticGen, schemaStrategy);
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
    yield* createStreamingGenerator(response, options, schemaStrategy, model) as AsyncGenerator<
      string,
      string,
      unknown
    >;

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
 * which has a single CodeBlockDetector that processes all content.
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
