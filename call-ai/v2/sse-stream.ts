import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { DataOutput } from "./data-stream.js";
import { isDataBegin, isDataLine, isDataEnd, isDataStats } from "./data-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { passthrough } from "./passthrough.js";

export const SseUsage = type({
  prompt_tokens: "number",
  completion_tokens: "number",
  total_tokens: "number",
});

export type SseUsage = typeof SseUsage.infer;

export const SseChunk = type({
  id: "string",
  provider: "string",
  model: "string",
  object: "string",
  created: "number",
  choices: type({
    index: "number",
    delta: {
      "role?": "string",
      "content?": "string",
      "reasoning?": "string|null",
      "reasoning_details?": "unknown[]",
      "images?": type({ type: "string", index: "number", image_url: { url: "string" } }).array(),
      "+": "delete",
    },
    finish_reason: "string|null",
    native_finish_reason: "string|null",
    logprobs: "unknown",
  }).array(),
  "system_fingerprint?": "string",
  "usage?": SseUsage,
  "+": "delete",
});

export type SseChunk = typeof SseChunk.infer;

export const SseBeginMsg = type({
  type: "'sse.begin'",
  streamId: "string",
  timestamp: CoercedDate,
});

export const SseLineMsg = type({
  type: "'sse.line'",
  streamId: "string",
  chunk: SseChunk,
  chunkNr: "number",
  timestamp: CoercedDate,
});

export const SseEndMsg = type({
  type: "'sse.end'",
  streamId: "string",
  "usage?": SseUsage,
  totalChunks: "number",
  totalErrors: "number",
  timestamp: CoercedDate,
});

export const SseErrorMsg = type({
  type: "'sse.error'",
  streamId: "string",
  error: "string",
  json: "unknown",
  errorNr: "number",
  timestamp: CoercedDate,
});

export const SseStatsMsg = type({
  type: "'sse.stats'",
  streamId: "string",
  stats: {
    chunkNr: "number",
    errorNr: "number",
  },
  timestamp: CoercedDate,
});

export const SseStreamMsg = SseBeginMsg.or(SseLineMsg).or(SseErrorMsg).or(SseEndMsg).or(SseStatsMsg);

export type SseBeginMsg = typeof SseBeginMsg.infer;
export type SseLineMsg = typeof SseLineMsg.infer;
export type SseErrorMsg = typeof SseErrorMsg.infer;
export type SseEndMsg = typeof SseEndMsg.infer;
export type SseStatsMsg = typeof SseStatsMsg.infer;
export type SseStreamMsg = typeof SseStreamMsg.infer;

// Type guards with optional streamId filter
export const isSseBegin = (msg: unknown, streamId?: string): msg is SseBeginMsg =>
  !(SseBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as SseBeginMsg).streamId === streamId);
export const isSseLine = (msg: unknown, streamId?: string): msg is SseLineMsg =>
  !(SseLineMsg(msg) instanceof type.errors) && (!streamId || (msg as SseLineMsg).streamId === streamId);
export const isSseError = (msg: unknown, streamId?: string): msg is SseErrorMsg =>
  !(SseErrorMsg(msg) instanceof type.errors) && (!streamId || (msg as SseErrorMsg).streamId === streamId);
export const isSseEnd = (msg: unknown, streamId?: string): msg is SseEndMsg =>
  !(SseEndMsg(msg) instanceof type.errors) && (!streamId || (msg as SseEndMsg).streamId === streamId);
export const isSseStats = (msg: unknown, streamId?: string): msg is SseStatsMsg =>
  !(SseStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as SseStatsMsg).streamId === streamId);
export const isSseMsg = (msg: unknown, streamId?: string): msg is SseStreamMsg =>
  !(SseStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as SseStreamMsg).streamId === streamId);

// Combined output type (passthrough + own events)
export type SseOutput = DataOutput | SseStreamMsg;

export function createSseStream(filterStreamId: string): TransformStream<DataOutput, SseOutput> {
  let chunkNr = 0;
  let errorNr = 0;
  let usage: SseUsage | undefined;
  let streamId = "";

  return new TransformStream<DataOutput, SseOutput>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "sse.stats",
          streamId: filterStreamId,
          stats: { chunkNr, errorNr },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough data.stats
      if (isDataStats(msg, filterStreamId)) {
        return;
      }

      if (isDataBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        controller.enqueue({
          type: "sse.begin",
          streamId,
          timestamp: new Date(),
        });
      } else if (isDataLine(msg, filterStreamId)) {
        const result = SseChunk(msg.json);
        if (result instanceof type.errors) {
          errorNr++;
          controller.enqueue({
            type: "sse.error",
            streamId,
            error: result.summary,
            json: msg.json,
            errorNr,
            timestamp: new Date(),
          });
          return;
        }
        chunkNr++;
        if (result.usage) {
          usage = result.usage;
        }
        controller.enqueue({
          type: "sse.line",
          streamId,
          chunk: result,
          chunkNr,
          timestamp: new Date(),
        });
      } else if (isDataEnd(msg, filterStreamId)) {
        controller.enqueue({
          type: "sse.end",
          streamId,
          ...(usage && { usage }),
          totalChunks: chunkNr,
          totalErrors: errorNr,
          timestamp: new Date(),
        });
      }
    }),
  });
}
