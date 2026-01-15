/**
 * call-ai: A lightweight library for making AI API calls
 */

// Export public types
export * from "./types.js";

// Export API functions
export { callAi } from "./api.js";
// Backward compatibility for callAI (uppercase AI)
export { callAi as callAI } from "./api.js";

// Event-based vibes streaming
export { VibesStream, VibesStreamOptions } from "./vibes-stream.js";
export {
  vibesBegin,
  vibesUpdate,
  vibesEnd,
  vibesError,
  vibesEvent,
  VibesBegin,
  VibesUpdate,
  VibesEnd,
  VibesError,
  VibesEvent,
  isVibesEventError,
} from "./vibes-events.js";

export { getMeta } from "./response-metadata.js";

// Export image generation function
export { imageGen } from "./image.js";

export { entriesHeaders, joinUrlParts } from "./utils.js";
export { callAiEnv } from "./env.js";

// Export parser module
export {
  LineStreamParser,
  LineStreamState,
  // Line parser arktype events
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
  SSEDataParser,
  // SSE parser arktype events
  sseData,
  sseDone,
  sseEvent,
  SseData,
  SseDone,
  SseEvent,
  isSseEventError,
  JsonParser,
  DataSource,
  SSEJsonParser,
  // JSON parser arktype events
  jsonPayload,
  jsonDone,
  jsonEvent,
  JsonPayload,
  JsonDone,
  JsonEvent,
  isJsonEventError,
  OpenRouterParser,
  orMeta,
  orDelta,
  orUsage,
  orDone,
  orStreamEnd,
  orJson,
  parserEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
  OrJson,
  ParserEvent,
  // Code block event types
  CodeBlockEvent,
  TextFragment,
  CodeStart,
  CodeFragment,
  CodeEnd,
  // Tool event types
  ToolStart,
  ToolArguments,
  ToolComplete,
  SegmentAccumulator,
  Segment,
} from "./parser/index.js";
