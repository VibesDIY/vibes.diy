import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isSseLine, type SseOutput } from "./sse-stream.js";

export const ImageMsg = type({
  type: "'block.img'",
  streamId: "string",
  index: "number",
  url: "string",
  timestamp: CoercedDate,
});

export type ImageMsg = typeof ImageMsg.infer;

export const isImageMsg = (msg: unknown, streamId?: string): msg is ImageMsg =>
  !(ImageMsg(msg) instanceof type.errors) && (!streamId || (msg as ImageMsg).streamId === streamId);

export type ImageOutput<T> = T | ImageMsg;

export function createImageStream<T>(filterStreamId: string): TransformStream<T | SseOutput, ImageOutput<T>> {
  return new TransformStream({
    transform(msg, controller) {
      controller.enqueue(msg as ImageOutput<T>);
      if (!isSseLine(msg, filterStreamId)) return;
      const images = msg.chunk.choices[0]?.delta?.images;
      if (!images) return;
      for (const img of images) {
        controller.enqueue({
          type: "block.img",
          streamId: filterStreamId,
          index: img.index ?? 0,
          url: img.image_url.url,
          timestamp: new Date(),
        });
      }
    },
  });
}
