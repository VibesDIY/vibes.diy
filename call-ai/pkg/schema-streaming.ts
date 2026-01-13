/**
 * Schema streaming - Uses ToolSchemaParser for structured output responses
 */

import { CallAIOptions, ResponseMeta, SchemaStrategy } from "./types.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { LineStreamParser, LineStreamState } from "./parser/line-stream.js";
import { SSEDataParser } from "./parser/sse-data-parser.js";
import { JsonParser } from "./parser/json-parser.js";
import { OpenRouterParser } from "./parser/openrouter-parser.js";
import { ToolSchemaParser } from "./parser/tool-schema-parser.js";

/**
 * Helper to check for old Claude tool_use format in JSON
 */
function extractOldFormatToolUse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  schemaStrategy: SchemaStrategy,
): string | null {
  // Direct type: "tool_use" format
  if (json.type === "tool_use") {
    return schemaStrategy.processResponse(json);
  }

  // stop_reason: "tool_use" with content array
  if (json.stop_reason === "tool_use") {
    if (json.content && Array.isArray(json.content)) {
      const toolUseBlock = json.content.find((block: { type: string }) => block.type === "tool_use");
      if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
    }
  }

  // choices[].message.content with tool_use block
  if (json.choices && Array.isArray(json.choices)) {
    const choice = json.choices[0];
    if (choice?.message?.content && Array.isArray(choice.message.content)) {
      const toolUseBlock = choice.message.content.find((block: { type: string }) => block.type === "tool_use");
      if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
    }
    if (choice?.delta?.content && Array.isArray(choice.delta.content)) {
      const toolUseBlock = choice.delta.content.find((block: { type: string }) => block.type === "tool_use");
      if (toolUseBlock) return schemaStrategy.processResponse(toolUseBlock);
    }
  }

  return null;
}

/**
 * Create parser stack with access to OpenRouterParser for old format handling
 */
function createSchemaParserWithOrParser(): { toolParser: ToolSchemaParser; orParser: OpenRouterParser } {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  const orParser = new OpenRouterParser(jsonParser);
  const toolParser = new ToolSchemaParser(orParser);
  return { toolParser, orParser };
}

/**
 * Parse SSE stream using ToolSchemaParser for tool_calls responses.
 *
 * This is the parser-based alternative to the legacy parseSSE function
 * for handling schema/tool_mode responses.
 *
 * Handles both:
 * - OpenAI format: choices[0].delta.tool_calls (via ToolSchemaParser)
 * - Old Claude format: type: "tool_use" with input field
 *
 * The legacy behavior only yields when finish_reason: "tool_calls" is received,
 * returning the complete assembled JSON string. This implementation matches
 * that behavior for backward compatibility.
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
  const { toolParser, orParser } = createSchemaParserWithOrParser();

  // Track final result - only set when tool call completes
  let finalResult: string | null = null;

  // Handle OpenAI format via ToolSchemaParser
  toolParser.onToolCallComplete((evt) => {
    finalResult = evt.arguments;
  });

  // Handle old Claude format via OpenRouterParser's onJson
  orParser.onJson((evt) => {
    const oldFormatResult = extractOldFormatToolUse(evt.json, schemaStrategy);
    if (oldFormatResult) {
      finalResult = oldFormatResult;
    }
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = textDecoder.decode(value, { stream: true });
      toolParser.processChunk(chunk);

      // Yield only when we have a complete result
      // This matches legacy behavior of yielding on finish_reason: "tool_calls"
      if (finalResult) {
        const processed = schemaStrategy.processResponse(finalResult);
        yield processed;
        // Reset so we don't yield again (in case of multiple tool calls)
        finalResult = null;
      }
    }

    // Finalize to ensure any remaining tool calls are emitted
    toolParser.finalize();

    // Yield any final result from finalize()
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
 * using ToolSchemaParser instead of manual parseSSE accumulation.
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
