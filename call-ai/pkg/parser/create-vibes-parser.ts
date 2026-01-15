import { createBaseParser } from "./create-base-parser.js";
import { createCodeBlockHandler } from "./handlers/code-block-handler.js";
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
  const orParser = createBaseParser();
  orParser.register(createCodeBlockHandler());
  return new SegmentAccumulator(orParser);
}
