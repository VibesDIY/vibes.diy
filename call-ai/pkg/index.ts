/**
 * call-ai: A lightweight library for making AI API calls
 */

// Export public types
export * from "./types.js";

// Export API functions
export { callAi } from "./api.js";
// Backward compatibility for callAI (uppercase AI)
export { callAi as callAI } from "./api.js";

// Vibes-specific streaming API
export { callVibes, VibesStreamResult } from "./call-vibes.js";

export { getMeta } from "./response-metadata.js";

// Export image generation function
export { imageGen } from "./image.js";

export { entriesHeaders, joinUrlParts } from "./utils.js";
export { callAiEnv } from "./env.js";

// Export parser module
export {
  LineStreamParser,
  LineStreamState,
  FragmentEvent,
  BracketEvent,
  BracketOpenCloseEvent,
  InBracketEvent,
  SSEDataParser,
  DataEvent,
  JsonParser,
  JsonEvent,
  DataSource,
  SSEJsonParser,
  SSEJsonEvent,
  OpenRouterParser,
  orMeta,
  orDelta,
  orUsage,
  orDone,
  orStreamEnd,
  orJson,
  orEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
  OrJson,
  OrEvent,
  CodeBlockParser,
  TextFragmentEvent,
  CodeStartEvent,
  CodeFragmentEvent,
  CodeEndEvent,
  CodeBlockEvent,
  SegmentAccumulator,
  Segment,
  createVibesParser,
} from "./parser/index.js";
