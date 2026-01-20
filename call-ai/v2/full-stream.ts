import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { DeltaOutput } from "./delta-stream.js";
import { isDeltaBegin, isDeltaLine, isDeltaEnd, isDeltaStats } from "./delta-stream.js";
import { isStatsCollect } from "./stats-stream.js";

export const FullBeginMsg = type({
  type: "'full.begin'",
  streamId: "string",
  id: "string",
  model: "string",
  timestamp: CoercedDate,
});

export const FullUsage = type({
  prompt_tokens: "number",
  completion_tokens: "number",
  total_tokens: "number",
  "+": "delete",
});

export type FullUsage = typeof FullUsage.infer;

export const FullEndMsg = type({
  type: "'full.end'",
  streamId: "string",
  index: "number",
  content: "string",
  finishReason: "string|null",
  "usage?": FullUsage,
  timestamp: CoercedDate,
});

export const FullStatsMsg = type({
  type: "'full.stats'",
  streamId: "string",
  stats: {
    totalChars: "number",
    indices: "number",
  },
  timestamp: CoercedDate,
});

export const FullStreamMsg = FullBeginMsg.or(FullEndMsg).or(FullStatsMsg);

export type FullBeginMsg = typeof FullBeginMsg.infer;
export type FullEndMsg = typeof FullEndMsg.infer;
export type FullStatsMsg = typeof FullStatsMsg.infer;
export type FullStreamMsg = typeof FullStreamMsg.infer;

// Type guards with optional streamId filter
export const isFullBegin = (msg: unknown, streamId?: string): msg is FullBeginMsg =>
  !(FullBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as FullBeginMsg).streamId === streamId);
export const isFullEnd = (msg: unknown, streamId?: string): msg is FullEndMsg =>
  !(FullEndMsg(msg) instanceof type.errors) && (!streamId || (msg as FullEndMsg).streamId === streamId);
export const isFullStats = (msg: unknown, streamId?: string): msg is FullStatsMsg =>
  !(FullStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as FullStatsMsg).streamId === streamId);
export const isFullMsg = (msg: unknown, streamId?: string): msg is FullStreamMsg =>
  !(FullStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as FullStreamMsg).streamId === streamId);

// Combined output type (passthrough + own events)
export type FullOutput = DeltaOutput | FullStreamMsg;

export function createFullStream(filterStreamId: string): TransformStream<DeltaOutput, FullOutput> {
  const contents = new Map<number, string>();
  let streamId = "";
  let totalChars = 0;

  return new TransformStream<DeltaOutput, FullOutput>({
    transform(msg, controller) {
      // Passthrough all upstream events
      controller.enqueue(msg);

      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "full.stats",
          streamId: filterStreamId,
          stats: { totalChars, indices: contents.size },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough delta.stats
      if (isDeltaStats(msg, filterStreamId)) {
        return;
      }

      if (isDeltaBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        controller.enqueue({
          type: "full.begin",
          streamId,
          id: msg.id,
          model: msg.model,
          timestamp: new Date(),
        });
      } else if (isDeltaLine(msg, filterStreamId)) {
        const current = contents.get(msg.index) ?? "";
        contents.set(msg.index, current + msg.content);
        totalChars += msg.content.length;
      } else if (isDeltaEnd(msg, filterStreamId)) {
        for (const [index, content] of contents) {
          controller.enqueue({
            type: "full.end",
            streamId,
            index,
            content,
            finishReason: msg.finishReason,
            ...(msg.usage && { usage: msg.usage }),
            timestamp: new Date(),
          });
        }
      }
    },
  });
}
