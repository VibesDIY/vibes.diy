import { type } from "arktype";
import mime from "mime";
import { rebuffer } from "@adviser/cement";
import { CoercedDate } from "./types.js";
import { isBlockImage, type BlockOutputMsg } from "./block-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { passthrough } from "./passthrough.js";
import type { SseOutput } from "./sse-stream.js";
import type { DeltaStreamMsg } from "./delta-stream.js";
import type { FullStreamMsg } from "./full-stream.js";

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

// image.begin - signals start of image processing
export const ImageBeginMsg = type({
  type: "'image.begin'",
  imageId: "string",
  id: "string",
  streamId: "string",
  seq: "number",
  mimetype: "string",
  suffix: "string",
  timestamp: CoercedDate,
});

// image.fragment - binary chunk
export const ImageFragmentMsg = type({
  type: "'image.fragment'",
  imageId: "string",
  id: "string",
  streamId: "string",
  seq: "number",
  mimetype: "string",
  suffix: "string",
  data: "unknown", // Uint8Array at runtime
  timestamp: CoercedDate,
});

// image.end - signals completion
export const ImageEndMsg = type({
  type: "'image.end'",
  imageId: "string",
  id: "string",
  streamId: "string",
  seq: "number",
  mimetype: "string",
  suffix: "string",
  size: "number",
  timestamp: CoercedDate,
});

// image.error - emitted when decode fails
export const ImageErrorMsg = type({
  type: "'image.error'",
  id: "string",
  streamId: "string",
  seq: "number",
  url: "string",
  error: "string",
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

export const ImageDecodeMsg = ImageBeginMsg.or(ImageFragmentMsg).or(ImageEndMsg).or(ImageErrorMsg).or(ImageStatsMsg);

// Inferred types
export type ImageBeginMsg = typeof ImageBeginMsg.infer;
export type ImageFragmentMsg = Omit<typeof ImageFragmentMsg.infer, "data"> & { data: Uint8Array };
export type ImageEndMsg = typeof ImageEndMsg.infer;
export type ImageErrorMsg = typeof ImageErrorMsg.infer;
export type ImageStatsMsg = typeof ImageStatsMsg.infer;
export type ImageDecodeMsg = ImageBeginMsg | ImageFragmentMsg | ImageEndMsg | ImageErrorMsg | ImageStatsMsg;

// Type guards with optional streamId filter
export const isImageBegin = (msg: unknown, streamId?: string): msg is ImageBeginMsg =>
  !(ImageBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageBeginMsg).streamId === streamId);
export const isImageFragment = (msg: unknown, streamId?: string): msg is ImageFragmentMsg =>
  !(ImageFragmentMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageFragmentMsg).streamId === streamId);
export const isImageEnd = (msg: unknown, streamId?: string): msg is ImageEndMsg =>
  !(ImageEndMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageEndMsg).streamId === streamId);
export const isImageError = (msg: unknown, streamId?: string): msg is ImageErrorMsg =>
  !(ImageErrorMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageErrorMsg).streamId === streamId);
export const isImageStats = (msg: unknown, streamId?: string): msg is ImageStatsMsg =>
  !(ImageStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageStatsMsg).streamId === streamId);
export const isImageDecodeMsg = (msg: unknown, streamId?: string): msg is ImageDecodeMsg =>
  !(ImageDecodeMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageDecodeMsg).streamId === streamId);

// Helper to decode base64 data URI to Uint8Array
function decodeDataUri(dataUri: string): { data: Uint8Array; mimetype: string; suffix: string } | undefined {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUri);
  if (!match) return undefined;
  const mimetype = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i);
  }
  const suffix = mime.getExtension(mimetype) || "bin";
  return { data, mimetype, suffix };
}

// Input type - union of all upstream types at this pipeline position
export type ImageDecodeInput = SseOutput | DeltaStreamMsg | FullStreamMsg | BlockOutputMsg;

// Combined output type (passthrough + image decode events)
export type ImageDecodeOutput = ImageDecodeInput | ImageDecodeMsg;

export function createImageDecodeStream(
  filterStreamId: string,
  createId: () => string
): TransformStream<ImageDecodeInput, ImageDecodeOutput> {
  let imageCount = 0;
  let totalBytes = 0;

  return new TransformStream<ImageDecodeInput, ImageDecodeOutput>({
    transform: passthrough(async (msg, controller) => {
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

      // Process block.image messages (no streamId filter - block.image uses blockStreamId)
      if (isBlockImage(msg)) {
        const decoded = decodeDataUri(msg.url);
        if (!decoded) {
          // Emit error for invalid data URI
          controller.enqueue({
            type: "image.error",
            id: msg.id,
            streamId: msg.streamId,
            seq: msg.seq,
            url: msg.url,
            error: "Invalid data URI format",
            timestamp: new Date(),
          });
          return;
        }

        const imageId = createId();
        imageCount++;
        totalBytes += decoded.data.length;

        // Emit image.begin
        controller.enqueue({
          type: "image.begin",
          imageId,
          id: msg.id,
          streamId: msg.streamId,
          seq: msg.seq,
          mimetype: decoded.mimetype,
          suffix: decoded.suffix,
          timestamp: new Date(),
        });

        // Create a stream from the decoded data and rebuffer it to fixed chunks
        const dataStream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(decoded.data);
            ctrl.close();
          },
        });

        const chunked = rebuffer(dataStream, CHUNK_SIZE);
        const reader = chunked.getReader();

        let seq = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue({
            type: "image.fragment",
            imageId,
            id: msg.id,
            streamId: msg.streamId,
            seq: seq++,
            mimetype: decoded.mimetype,
            suffix: decoded.suffix,
            data: value,
            timestamp: new Date(),
          });
        }

        // Emit image.end
        controller.enqueue({
          type: "image.end",
          imageId,
          id: msg.id,
          streamId: msg.streamId,
          seq: msg.seq,
          mimetype: decoded.mimetype,
          suffix: decoded.suffix,
          size: decoded.data.length,
          timestamp: new Date(),
        });
      }
    }),
  });
}
