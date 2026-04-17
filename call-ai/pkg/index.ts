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

// imageGen removed — now routed through vibes.diy service (mode='img')

export { entriesHeaders, joinUrlParts } from "./utils.js";
export { callAiEnv } from "./env.js";
