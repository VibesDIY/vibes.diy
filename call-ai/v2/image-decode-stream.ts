import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isBlockImage, type BlockOutputMsg } from "./block-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import type { SseOutput } from "./sse-stream.js";
import type { DeltaStreamMsg } from "./delta-stream.js";
import type { FullStreamMsg } from "./full-stream.js";

// image.begin - signals start of image processing
export const ImageBeginMsg = type({
  type: "'image.begin'",
  id: "string",
  streamId: "string",
  index: "number",
  mimetype: "string",
  timestamp: CoercedDate,
});

// image.fragment - binary chunk
export const ImageFragmentMsg = type({
  type: "'image.fragment'",
  id: "string",
  streamId: "string",
  index: "number",
  data: "unknown", // Uint8Array at runtime
  fragmentIndex: "number",
  timestamp: CoercedDate,
});

// image.end - signals completion
export const ImageEndMsg = type({
  type: "'image.end'",
  id: "string",
  streamId: "string",
  index: "number",
  mimetype: "string",
  size: "number",
  timestamp: CoercedDate,
});

// image.stats - emitted on stats.collect
export const ImageStatsMsg = type({
  type: "'image.stats'",
  streamId: "string",
  stats: {
    imageCount: "number",
    totalBytes: "number",
  },
  timestamp: CoercedDate,
});

export const ImageDecodeMsg = ImageBeginMsg.or(ImageFragmentMsg).or(ImageEndMsg).or(ImageStatsMsg);

// Inferred types
export type ImageBeginMsg = typeof ImageBeginMsg.infer;
// Override the inferred type to use Uint8Array instead of unknown
export interface ImageFragmentMsg {
  type: "image.fragment";
  id: string;
  streamId: string;
  index: number;
  data: Uint8Array;
  fragmentIndex: number;
  timestamp: Date;
}
export type ImageEndMsg = typeof ImageEndMsg.infer;
export type ImageStatsMsg = typeof ImageStatsMsg.infer;
export type ImageDecodeMsg = ImageBeginMsg | ImageFragmentMsg | ImageEndMsg | ImageStatsMsg;

// Type guards with optional streamId filter
export const isImageBegin = (msg: unknown, streamId?: string): msg is ImageBeginMsg =>
  !(ImageBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageBeginMsg).streamId === streamId);
export const isImageFragment = (msg: unknown, streamId?: string): msg is ImageFragmentMsg =>
  !(ImageFragmentMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageFragmentMsg).streamId === streamId);
export const isImageEnd = (msg: unknown, streamId?: string): msg is ImageEndMsg =>
  !(ImageEndMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageEndMsg).streamId === streamId);
export const isImageStats = (msg: unknown, streamId?: string): msg is ImageStatsMsg =>
  !(ImageStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageStatsMsg).streamId === streamId);
export const isImageDecodeMsg = (msg: unknown, streamId?: string): msg is ImageDecodeMsg =>
  !(ImageDecodeMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageDecodeMsg).streamId === streamId);

// Helper to decode base64 data URI to Uint8Array
function decodeDataUri(dataUri: string): { data: Uint8Array; mimetype: string } | undefined {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUri);
  if (!match) return undefined;
  const mimetype = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i);
  }
  return { data, mimetype };
}

// Input type - union of all upstream types at this pipeline position
export type ImageDecodeInput = SseOutput | DeltaStreamMsg | FullStreamMsg | BlockOutputMsg;

// Combined output type (passthrough + image decode events)
export type ImageDecodeOutput = ImageDecodeInput | ImageDecodeMsg;

export function createImageDecodeStream(filterStreamId: string): TransformStream<ImageDecodeInput, ImageDecodeOutput> {
  let imageCount = 0;
  let totalBytes = 0;

  return new TransformStream<ImageDecodeInput, ImageDecodeOutput>({
    transform(msg, controller) {
      // Passthrough all upstream events
      controller.enqueue(msg);

      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "image.stats",
          streamId: filterStreamId,
          stats: { imageCount, totalBytes },
          timestamp: new Date(),
        });
        return;
      }

      // Process block.image messages
      if (isBlockImage(msg, filterStreamId)) {
        const decoded = decodeDataUri(msg.url);
        if (!decoded) {
          // Not a data URI, skip decoding (could be external URL)
          return;
        }

        imageCount++;
        totalBytes += decoded.data.length;

        // Emit image.begin
        controller.enqueue({
          type: "image.begin",
          id: msg.id,
          streamId: msg.streamId,
          index: msg.index,
          mimetype: decoded.mimetype,
          timestamp: new Date(),
        });

        // Emit image.fragment (single fragment for now)
        controller.enqueue({
          type: "image.fragment",
          id: msg.id,
          streamId: msg.streamId,
          index: msg.index,
          data: decoded.data,
          fragmentIndex: 0,
          timestamp: new Date(),
        });

        // Emit image.end
        controller.enqueue({
          type: "image.end",
          id: msg.id,
          streamId: msg.streamId,
          index: msg.index,
          mimetype: decoded.mimetype,
          size: decoded.data.length,
          timestamp: new Date(),
        });
      }
    },
  });
}
