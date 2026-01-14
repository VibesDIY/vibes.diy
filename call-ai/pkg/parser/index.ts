/**
 * Parser module - Streaming parsers for SSE, JSON, and OpenRouter responses
 */

export {
  LineStreamParser,
  LineStreamState,
  // Legacy types still exported for internal xstate use
  FragmentEvent,
  BracketEvent,
  BracketOpenCloseEvent,
  InBracketEvent,
} from "./line-stream.js";

// Line parser arktype events
export {
  lineFragment,
  lineBracketOpen,
  lineBracketClose,
  lineContent,
  lineEvent,
  LineFragment,
  LineBracketOpen,
  LineBracketClose,
  LineContent,
  LineEvent,
  isLineEventError,
} from "./line-events.js";

export { SSEDataParser } from "./sse-data-parser.js";

// SSE parser arktype events
export {
  sseData,
  sseDone,
  sseEvent,
  SseData,
  SseDone,
  SseEvent,
  isSseEventError,
} from "./sse-events.js";

export { JsonParser, DataSource, SSEJsonParser } from "./json-parser.js";
export {
  jsonPayload,
  jsonDone,
  jsonEvent,
  JsonPayload,
  JsonDone,
  JsonEvent,
  isJsonEventError,
} from "./json-events.js";

// Backward compatibility alias
export type { JsonEvent as SSEJsonEvent } from "./json-events.js";

export { OpenRouterParser } from "./openrouter-parser.js";
export { NonStreamingOpenRouterParser } from "./non-streaming-openrouter-parser.js";
export { ImageParser } from "./image-parser.js";
export {
  orMeta,
  orDelta,
  orUsage,
  orDone,
  orStreamEnd,
  orJson,
  orImage,
  orEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
  OrJson,
  OrImage,
  OrEvent,
  OrEventSource,
} from "./openrouter-events.js";

export {
  CodeBlockParser,
  CodeBlockEvent,
  TextFragmentEvent,
  CodeStartEvent,
  CodeFragmentEvent,
  CodeEndEvent,
} from "./code-block-parser.js";

export { SegmentAccumulator, Segment } from "./segment-accumulator.js";

export { createVibesParser } from "./create-vibes-parser.js";

export {
  ToolSchemaParser,
  ToolCallStartEvent,
  ToolCallArgumentsEvent,
  ToolCallCompleteEvent,
} from "./tool-schema-parser.js";
