import { LineStreamParser, LineStreamState } from "./line-stream.js";
import { SSEDataParser } from "./sse-data-parser.js";
import { JsonParser } from "./json-parser.js";
import { OpenRouterParser } from "./openrouter-parser.js";
import { CodeBlockParser } from "./code-block-parser.js";
import { SegmentAccumulator } from "./segment-accumulator.js";

/**
 * Creates a fully-wired streaming parser stack for OpenRouter SSE responses.
 *
 * Returns a SegmentAccumulator that builds Segment[] as chunks arrive.
 *
 * Usage:
 * ```typescript
 * import { createVibesParser } from "call-ai";
 *
 * const parser = createVibesParser();
 *
 * for await (const chunk of response.body) {
 *   parser.processChunk(chunk);
 *   // parser.segments grows as content arrives
 *   render(parser.segments);
 * }
 * ```
 */
export function createVibesParser(): SegmentAccumulator {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  const orParser = new OpenRouterParser(jsonParser);
  const codeParser = new CodeBlockParser(orParser);
  return new SegmentAccumulator(codeParser);
}
