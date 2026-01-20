/**
 * call-ai: A lightweight library for making AI API calls
 */

// Core API
export { callAi, callAI, imageGen, getMeta, callAiEnv } from "@vibes.diy/call-ai-base";

// Vibes streaming
export {
  VibesStream,
  type VibesStreamOptions,
  vibesBegin,
  vibesUpdate,
  vibesEnd,
  vibesError,
  vibesEvent,
  type VibesBegin,
  type VibesUpdate,
  type VibesEnd,
  type VibesError,
  type VibesEvent,
  isVibesEventError,
} from "@vibes.diy/call-ai-base";

// Types from types.ts (selectively re-exported)
export type {
  Message,
  CallAIOptions,
  Schema,
  ImageGenOptions,
  ImageResponse,
  ContentItem,
  AIResponse,
  ResponseMeta,
} from "@vibes.diy/call-ai-base";

export { CallAIError } from "@vibes.diy/call-ai-base";

// Utils
export { joinUrlParts, entriesHeaders } from "@vibes.diy/call-ai-base";

// Advanced parser (documented in README)
export {
  OpenRouterParser,
  createCodeBlockHandler,
  SegmentAccumulator,
  type Segment,
  type ParserEvent,
} from "@vibes.diy/call-ai-base";
