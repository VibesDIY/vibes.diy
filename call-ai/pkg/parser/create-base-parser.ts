import { OpenRouterParser } from "./openrouter-parser.js";

/**
 * Creates the base streaming parser for OpenRouter SSE responses.
 *
 * This is the shared foundation used by all streaming modules:
 * - text-streaming.ts (uses onDelta directly)
 * - vibes-streaming.ts (wraps with CodeBlockParser)
 * - schema-streaming.ts (wraps with ToolSchemaParser)
 *
 * OpenRouterParser internally creates its own parser chain:
 * LineStreamParser → SSEDataParser → JsonParser
 */
export function createBaseParser(): OpenRouterParser {
  return new OpenRouterParser();
}
