/**
 * call-ai: A lightweight library for making AI API calls
 */

// Export public types
export * from "./types.js";

// Export API functions
export { callAi } from "./api.js";
// Backward compatibility for callAI (uppercase AI)
export { callAi as callAI } from "./api.js";

export { getMeta } from "./response-metadata.js";

// Export image generation function
export { imageGen } from "./image.js";

export { entriesHeaders, joinUrlParts } from "./utils.js";
export { callAiEnv } from "./env.js";

// Export stream parsing
export { parseAIStream, collectStreamMessages } from "./stream-parser.js";
export { detectCodeBlocks } from "./code-block-detector.js";
export {
  StreamMessage,
  StreamType,
  StreamTypes,
  StreamMessageSchema,
  createMessage,
  isMessageType,
  nextId,
  nextStreamId,
  // Payload types
  StreamStartPayload,
  StreamEndPayload,
  StreamErrorPayload,
  TextFragmentPayload,
  TextCompletePayload,
  CodeStartPayload,
  CodeFragmentPayload,
  CodeEndPayload,
  CodeFullPayload,
  CodeEditPayload,
  ImgPayload,
} from "./stream-messages.js";
