import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isSseLine, isSseEnd, isSseStats, SseStreamMsg, SseUsage, SSeImage } from "./sse-stream.js";
import { isStatsCollect, StatsCollectMsg } from "./stats-stream.js";
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
  deltaSeq: "number",
  choiceSeq: "number",
  timestamp: CoercedDate,
});

export const DeltaUsageMsg = type({
  type: "'delta.usage'",
  streamId: "string",
  usage: SseUsage,
  deltaSeq: "number",
  timestamp: CoercedDate,
});

export const DeltaImageMsg = type({
  type: "'delta.image'",
  streamId: "string",
  imageId: "string",
  imageSeq: "number",
  image: SSeImage,
  choiceSeq: "number",
  deltaSeq: "number",
  index: "number",
  timestamp: CoercedDate,
});

export const DeltaEndMsg = type({
  type: "'delta.end'",
  streamId: "string",
  finishReasons: "string[]",
  usages: SseUsage.array(),
  totalDeltas: "number",
  totalChars: "number",
  timestamp: CoercedDate,
});

export const DeltaStatsMsg = type({
  type: "'delta.stats'",
  streamId: "string",
  stats: {
    deltaSeq: "number",
    deltaUsages: "number",
    totalChars: "number",
  },
  timestamp: CoercedDate,
});

export const DeltaStreamMsg = DeltaBeginMsg.or(DeltaLineMsg).or(DeltaEndMsg).or(DeltaStatsMsg).or(DeltaUsageMsg).or(DeltaImageMsg);

export type DeltaBeginMsg = typeof DeltaBeginMsg.infer;
export type DeltaLineMsg = typeof DeltaLineMsg.infer;
export type DeltaEndMsg = typeof DeltaEndMsg.infer;
export type DeltaStatsMsg = typeof DeltaStatsMsg.infer;
export type DeltaUsageMsg = typeof DeltaUsageMsg.infer;
export type DeltaImageMsg = typeof DeltaImageMsg.infer;
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
export const isDeltaUsage = (msg: unknown, streamId?: string): msg is DeltaUsageMsg =>
  !(DeltaUsageMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaUsageMsg).streamId === streamId);
export const isDeltaImage = (msg: unknown, streamId?: string): msg is DeltaImageMsg =>
  !(DeltaImageMsg(msg) instanceof type.errors) && (!streamId || (msg as DeltaImageMsg).streamId === streamId);

// Combined output type (passthrough + own events)

export function createDeltaStream(
  filterStreamId: string,
  createId: () => string
): TransformStream<SseStreamMsg | DeltaStreamMsg | StatsCollectMsg, DeltaStreamMsg> {
  let started = false;
  let deltaSeq = 0;
  let deltaUsages = 0;
  let totalChars = 0;
  const usages: SseUsage[] = [];
  const finishReasons: string[] = [];

  return new TransformStream<SseStreamMsg | DeltaStreamMsg, DeltaStreamMsg>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "delta.stats",
          streamId: filterStreamId,
          stats: { deltaSeq, deltaUsages, totalChars },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough sse.stats
      if (isSseStats(msg, filterStreamId)) {
        return;
      }

      if (isSseLine(msg, filterStreamId)) {
        if (!started) {
          started = true;
          controller.enqueue({
            type: "delta.begin",
            streamId: filterStreamId,
            id: msg.chunk.id,
            model: msg.chunk.model,
            timestamp: new Date(),
          });
        }
        if (msg.chunk.usage) {
          deltaUsages++;
          usages.push(msg.chunk.usage);
          controller.enqueue({
            type: "delta.usage",
            streamId: filterStreamId,
            usage: msg.chunk.usage,
            deltaSeq: deltaSeq++,
            timestamp: new Date(),
          });
        }
        msg.chunk.choices.forEach((choice, choiceSeq) => {
          const content = choice?.delta?.content;
          if (content) {
            totalChars += content.length;
            controller.enqueue({
              type: "delta.line",
              streamId: filterStreamId,
              index: choice.index,
              choiceSeq,
              content,
              deltaSeq: deltaSeq++,
              timestamp: new Date(),
            });
          }
          const images = choice?.delta?.images;
          if (Array.isArray(images)) {
            images.forEach((img, imageSeq) => {
              deltaSeq++;
              controller.enqueue({
                type: "delta.image",
                streamId: filterStreamId,
                imageId: createId(),
                index: choice.index,
                choiceSeq,
                image: img,
                imageSeq,
                deltaSeq: deltaSeq++,
                timestamp: new Date(),
              });
            });
          }
          if (choice?.finish_reason) {
            finishReasons.push(choice.finish_reason);
          }
        });
      }
      if (isSseEnd(msg, filterStreamId)) {
        controller.enqueue({
          type: "delta.end",
          streamId: filterStreamId,
          finishReasons,
          usages: msg.usages,
          totalDeltas: deltaSeq,
          totalChars,
          timestamp: new Date(),
        });
      }
    }),
  });
}
