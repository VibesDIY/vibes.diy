// Re-export all from each stream module
export * from "./types.js";
export * from "./stats-stream.js";
export * from "./line-stream.js";
export * from "./data-stream.js";
export * from "./sse-stream.js";
export * from "./delta-stream.js";
export * from "./full-stream.js";
export * from "./block-stream.js";
export * from "./image-decode-stream.js";
export * from "./passthrough.js";

// Unified event type (all possible messages from full pipeline)
import type { StatsCollectMsg } from "./stats-stream.js";
import type { FullOutput } from "./full-stream.js";
import type { BlockOutputMsg, BlockImageMsg } from "./block-stream.js";
import type { LineStreamOutput } from "./line-stream.js";
import type { ImageDecodeMsg } from "./image-decode-stream.js";
export type StreamEvent = StatsCollectMsg | FullOutput | LineStreamOutput | BlockOutputMsg | BlockImageMsg | ImageDecodeMsg;
