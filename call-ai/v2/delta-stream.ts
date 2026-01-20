import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { SseOutput } from "./sse-stream.js";
import { isSseBegin, isSseLine, isSseEnd, isSseStats } from "./sse-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { createLineStream, type LineStreamInput } from "./line-stream.js";
import { consumeStream } from "@adviser/cement";
import { createBlockStream, type BlockOutputMsg } from "./block-stream.js";
import { passthrough } from "./passthrough.js";

export const DeltaBeginMsg = type({
  type: "'delta.begin'",
  streamId: "string",
  id: "string",
  model: "string",
  timestamp: CoercedDate,
});

export const DeltaLineMsg = type({
  type: "'delta.line'",
  streamId: "string",
  index: "number",
  content: "string",
  "usage?": {
    prompt_tokens: "number",
    completion_tokens: "number",
    total_tokens: "number",
    "+": "delete",
  },
  deltaNr: "number",
  timestamp: CoercedDate,
});

export const DeltaUsage = type({
  prompt_tokens: "number",
  completion_tokens: "number",
  total_tokens: "number",
  "+": "delete",
});

export type DeltaUsage = typeof DeltaUsage.infer;

export const DeltaEndMsg = type({
  type: "'delta.end'",
  streamId: "string",
  finishReason: "string|null",
  "usage?": DeltaUsage,
  totalDeltas: "number",
  totalChars: "number",
  timestamp: CoercedDate,
});

export const DeltaStatsMsg = type({
  type: "'delta.stats'",
  streamId: "string",
  stats: {
    deltaNr: "number",
    totalChars: "number",
  },
  timestamp: CoercedDate,
});

export const DeltaStreamMsg = DeltaBeginMsg.or(DeltaLineMsg).or(DeltaEndMsg).or(DeltaStatsMsg);

export type DeltaBeginMsg = typeof DeltaBeginMsg.infer;
export type DeltaLineMsg = typeof DeltaLineMsg.infer;
export type DeltaEndMsg = typeof DeltaEndMsg.infer;
export type DeltaStatsMsg = typeof DeltaStatsMsg.infer;
export type DeltaStreamMsg = typeof DeltaStreamMsg.infer;

// Type guards with optional streamId filter
export const isDeltaBegin = (msg: unknown, streamId?: string): msg is DeltaBeginMsg =>
  !(DeltaBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaBeginMsg).streamId === streamId);
export const isDeltaLine = (msg: unknown, streamId?: string): msg is DeltaLineMsg =>
  !(DeltaLineMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaLineMsg).streamId === streamId);
export const isDeltaEnd = (msg: unknown, streamId?: string): msg is DeltaEndMsg =>
  !(DeltaEndMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaEndMsg).streamId === streamId);
export const isDeltaStats = (msg: unknown, streamId?: string): msg is DeltaStatsMsg =>
  !(DeltaStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaStatsMsg).streamId === streamId);
export const isDeltaMsg = (msg: unknown, streamId?: string): msg is DeltaStreamMsg =>
  !(DeltaStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaStreamMsg).streamId === streamId);

// Combined output type (passthrough + own events)
export type DeltaOutput = SseOutput | DeltaStreamMsg;

export function createDeltaStream(filterStreamId: string): TransformStream<SseOutput, DeltaOutput> {
  let started = false;
  let deltaNr = 0;
  let totalChars = 0;
  let finishReason: string | null = null;
  let streamId = "";

  return new TransformStream<SseOutput, DeltaOutput>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "delta.stats",
          streamId: filterStreamId,
          stats: { deltaNr, totalChars },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough sse.stats
      if (isSseStats(msg, filterStreamId)) {
        return;
      }

      if (isSseBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        // Wait for first sse.line to get id/model
      } else if (isSseLine(msg, filterStreamId)) {
        const chunk = msg.chunk;
        const choice = chunk.choices[0];

        if (!started) {
          started = true;
          controller.enqueue({
            type: "delta.begin",
            streamId,
            id: chunk.id,
            model: chunk.model,
            timestamp: new Date(),
          });
        }

        const content = choice?.delta?.content ?? "";
        if (content) {
          deltaNr++;
          totalChars += content.length;
          controller.enqueue({
            type: "delta.line",
            streamId,
            index: choice.index,
            content,
            ...(chunk.usage && { usage: chunk.usage }),
            deltaNr,
            timestamp: new Date(),
          });
        }

        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      } else if (isSseEnd(msg, filterStreamId)) {
        controller.enqueue({
          type: "delta.end",
          streamId,
          finishReason,
          ...(msg.usage && { usage: msg.usage }),
          totalDeltas: deltaNr,
          totalChars,
          timestamp: new Date(),
        });
      }
    }),
  });
}

// Output type for createLineStreamFromDelta (passthrough + block events)
export type DeltaBlockOutput = DeltaOutput | BlockOutputMsg;

export function createLineStreamFromDelta(
  filterStreamId: string,
  createId: () => string,
): TransformStream<DeltaOutput, DeltaBlockOutput> {
  let transStream: TransformStream<LineStreamInput>;
  let writer: WritableStreamDefaultWriter<LineStreamInput>;
  let consumePromise: Promise<unknown>;
  let blockStreamId: string;
  let imageIndex = 0;
  return new TransformStream<DeltaOutput, DeltaBlockOutput>({
    async transform(msg, controller) {
      controller.enqueue(msg);
      switch (true) {
        case isDeltaBegin(msg, filterStreamId): {
          blockStreamId = createId();
          transStream = new TransformStream<LineStreamInput>();
          writer = transStream.writable.getWriter();
          consumePromise = consumeStream(
            transStream.readable
              .pipeThrough(createLineStream(blockStreamId))
              .pipeThrough(createBlockStream<never>(blockStreamId, createId)),
            (e) => controller.enqueue(e),
          );
          break;
        }
        case isDeltaLine(msg, filterStreamId):
          writer?.write(new TextEncoder().encode(msg.content));
          break;
        case isSseLine(msg, filterStreamId): {
          // Emit block.image directly for any images in the SSE chunk
          const images = msg.chunk.choices[0]?.delta?.images;
          if (images) {
            for (const img of images) {
              imageIndex++;
              controller.enqueue({
                type: "block.image",
                id: createId(),
                streamId: blockStreamId,
                seq: imageIndex,
                ...(img.index !== undefined && { index: img.index }),
                url: img.image_url.url,
                timestamp: new Date(),
              });
            }
          }
          break;
        }
        case isDeltaEnd(msg, filterStreamId):
          if (writer) {
            await writer.close().then(() => consumePromise);
          } else {
            await consumePromise;
          }
          break;
        case isStatsCollect(msg, filterStreamId):
          // Forward stats.collect to the inner line/block pipeline with its own streamId
          writer?.write({ ...msg, streamId: blockStreamId });
          break;
        default:
          break;
      }
    },
  });
}
