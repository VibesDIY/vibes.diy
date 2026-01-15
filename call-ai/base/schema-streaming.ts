/**
 * Schema streaming - Uses toolHandler for structured output responses
 */

import { CallAIOptions, ResponseMeta, SchemaStrategy } from "./types.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { OpenRouterParser } from "./parser/openrouter-parser.js";

/**
 * Parse SSE stream using toolHandler for tool_calls responses.
 *
 * All tool formats (OpenAI tool_calls, Claude tool_use) are handled by
 * toolHandler which emits tool.complete events.
 *
 * @param response - Fetch Response with SSE body
 * @param schemaStrategy - Strategy for processing the response
 * @yields Complete JSON string only when tool call is complete
 * @returns Final complete JSON string
 */
async function* parseSchemaSSE(response: Response, schemaStrategy: SchemaStrategy): AsyncGenerator<string, string, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is undefined - API endpoint may not support streaming");
  }

  const textDecoder = new TextDecoder();
  const orParser = new OpenRouterParser();

  // Track final result - only set when tool call completes
  let finalResult: string | null = null;

  // Listen for tool.complete events (toolHandler handles all formats)
  orParser.onEvent((evt) => {
    if (evt.type === "tool.complete") {
      finalResult = evt.arguments;
    }
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = textDecoder.decode(value, { stream: true });
      orParser.processChunk(chunk);

      // Yield only when we have a complete result
      // This matches legacy behavior of yielding on finish_reason: "tool_calls"
      if (finalResult) {
        const processed = schemaStrategy.processResponse(finalResult);
        yield processed;
        // Reset so we don't yield again (in case of multiple tool calls)
        finalResult = null;
      }
    }

    // Signal stream end to flush any buffered content
    orParser.finalize();

    // Yield any final result from stream end
    if (finalResult) {
      const processed = schemaStrategy.processResponse(finalResult);
      yield processed;
      return processed;
    }

    return "";
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a streaming generator for schema responses using the parser stack.
 *
 * This replaces createStreamingGenerator for tool_mode schema responses,
 * using toolHandler's tool.complete events instead of manual parseSSE accumulation.
 */
export async function* createSchemaStreamingGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string, string, unknown> {
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

  // Stream through the parser
  let finalResult = "";
  for await (const chunk of parseSchemaSSE(response, schemaStrategy)) {
    finalResult = chunk;
    yield chunk;
  }

  // Update timing
  const endTime = Date.now();
  meta.timing.endTime = endTime;
  meta.timing.duration = endTime - meta.timing.startTime;
  meta.rawResponse = finalResult;

  // Store metadata for getMeta() retrieval
  const boxed = boxString(finalResult);
  responseMetadata.set(boxed, meta);

  return finalResult;
}
