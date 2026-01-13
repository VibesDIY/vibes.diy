import { LineStreamParser, LineStreamState } from "./line-stream.js";
import { SSEDataParser } from "./sse-data-parser.js";
import { JsonParser } from "./json-parser.js";
import { OpenRouterParser } from "./openrouter-parser.js";

/**
 * Creates the base streaming parser stack for OpenRouter SSE responses.
 *
 * This is the shared foundation used by all streaming modules:
 * - text-streaming.ts (uses onDelta directly)
 * - vibes-streaming.ts (wraps with CodeBlockParser)
 * - schema-streaming.ts (wraps with ToolSchemaParser)
 *
 * Stack: LineStreamParser → SSEDataParser → JsonParser → OpenRouterParser
 */
export function createBaseParser(): OpenRouterParser {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  return new OpenRouterParser(jsonParser);
}
