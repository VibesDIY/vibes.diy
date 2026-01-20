import { promises as fs } from "node:fs";
import { join } from "node:path";
import { isImageEnd, isImageFragment, type ImageDecodeOutput } from "./image-decode-stream.js";

// Map mimetype to file extension
function mimetypeToExt(mimetype: string): string {
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return extMap[mimetype] || "bin";
}

// State for accumulating image fragments
interface ImageState {
  fragments: Map<string, Uint8Array[]>;
}

export interface ImageSaveResultMsg {
  type: "image.saved";
  id: string;
  streamId: string;
  index: number;
  path: string;
  size: number;
  timestamp: Date;
}

// Combined output type (passthrough + save results)
export type ImageSaverOutput = ImageDecodeOutput | ImageSaveResultMsg;

export function createImageSaver(outputDir: string): TransformStream<ImageDecodeOutput, ImageSaverOutput> {
  const state: ImageState = {
    fragments: new Map(),
  };

  return new TransformStream<ImageDecodeOutput, ImageSaverOutput>({
    async transform(msg, controller) {
      // Passthrough all upstream events
      controller.enqueue(msg);

      // Accumulate fragments
      if (isImageFragment(msg)) {
        const existing = state.fragments.get(msg.id) || [];
        existing.push(msg.data);
        state.fragments.set(msg.id, existing);
        return;
      }

      // On image.end, write accumulated data to file
      if (isImageEnd(msg)) {
        const fragments = state.fragments.get(msg.id);
        if (!fragments || fragments.length === 0) return;

        // Combine fragments
        const totalLength = fragments.reduce((sum, f) => sum + f.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const fragment of fragments) {
          combined.set(fragment, offset);
          offset += fragment.length;
        }

        // Determine filename
        const ext = mimetypeToExt(msg.mimetype);
        const filename = `${msg.id}.${ext}`;
        const filepath = join(outputDir, filename);

        // Write to file
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(filepath, combined);

        // Clean up state
        state.fragments.delete(msg.id);

        // Emit save result
        controller.enqueue({
          type: "image.saved",
          id: msg.id,
          streamId: msg.streamId,
          index: msg.index,
          path: filepath,
          size: combined.length,
          timestamp: new Date(),
        });
      }
    },
  });
}
