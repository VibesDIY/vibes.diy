/**
 * Parser module - Streaming parsers for SSE, JSON, and OpenRouter responses
 */

export { LineStreamParser, LineStreamState } from "./line-stream.js";

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
export { sseData, sseDone, sseEvent, SseData, SseDone, SseEvent, isSseEventError } from "./sse-events.js";

export { JsonParser, DataSource, SSEJsonParser } from "./json-parser.js";
export { jsonPayload, jsonDone, jsonEvent, JsonPayload, JsonDone, JsonEvent, isJsonEventError } from "./json-events.js";

export { OpenRouterParser } from "./openrouter-parser.js";
export { NonStreamingOpenRouterParser } from "./non-streaming-openrouter-parser.js";
export {
  ParserEvento,
  ParserHandler,
  orMeta,
  orDelta,
  orUsage,
  orDone,
  orStreamEnd,
  orJson,
  orImage,
  parserEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
  OrJson,
  OrImage,
  ParserEvent,
  ParserEventSource,
  isParserEventError,
} from "./parser-evento.js";

export { SegmentAccumulator, Segment } from "./segment-accumulator.js";

// Tool event types from parser-evento (replaces ToolSchemaParser)
export { toolStart, toolArguments, toolComplete, ToolStart, ToolArguments, ToolComplete } from "./parser-evento.js";

// Code block event types
export {
  textFragment,
  codeStart,
  codeFragment,
  codeEnd,
  TextFragment,
  CodeStart,
  CodeFragment,
  CodeEnd,
  CodeBlockEvent,
} from "./parser-evento.js";

export { createCodeBlockHandler } from "./handlers/code-block-handler.js";
export { toolHandler, createToolHandler } from "./handlers/tool-handler.js";
export { imageHandler } from "./handlers/image-handler.js";

// Adapters
export { StreamingAdapter } from "./adapters/streaming-adapter.js";
export { NonStreamingAdapter } from "./adapters/non-streaming-adapter.js";
