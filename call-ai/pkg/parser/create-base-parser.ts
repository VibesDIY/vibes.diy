import { OpenRouterParser } from "./openrouter-parser.js";

/**
 * Creates the base streaming parser for OpenRouter SSE responses.
 *
 * This is the shared foundation used by all streaming modules:
 * - text-streaming.ts (uses onDelta directly)
 * - vibes-streaming.ts (registers codeBlockHandler)
 * - schema-streaming.ts (uses toolHandler for tool.* events)
 *
 * OpenRouterParser internally creates its own parser chain:
 * LineStreamParser → SSEDataParser → JsonParser
 *
 * Default handlers (imageHandler, toolHandler) are auto-registered.
 */
export function createBaseParser(): OpenRouterParser {
  return new OpenRouterParser();
}
