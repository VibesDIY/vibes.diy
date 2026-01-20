import { command, run, string, option, flag } from "cmd-ts";
import { dotenv } from "zx";
import { promises as fs } from "node:fs";
import {
  createStatsCollector,
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  createFullStream,
  createImageDecodeStream,
  isLineMsg,
  isDataMsg,
  isSseMsg,
  isDeltaMsg,
  isFullMsg,
  isBlockOutput,
  isBlockImage,
  isImageDecodeMsg,
  isImageFragment,
  isImageEnd,
  isStatsCollect,
  isLineStats,
  isDataStats,
  isSseStats,
  isDeltaStats,
  isFullStats,
  isBlockStats,
  isImageStats,
} from "./index.js";
import { createLineStreamFromDelta } from "./delta-stream.js";
import mime from "mime";
import { join } from "node:path";
import { ensureSuperThis } from "@fireproof/core-runtime";

const env = dotenv.load(".env");

const app = command({
  name: "call-ai",
  description: "Stream responses from OpenRouter.ai",
  args: {
    prompt: option({
      type: string,
      long: "prompt",
      short: "p",
      description: "The prompt to send to the AI",
      defaultValue: () => "",
    }),
    src: option({
      type: string,
      long: "src",
      short: "s",
      description: "Read stream from file (skip API call)",
      defaultValue: () => "",
    }),
    model: option({
      type: string,
      long: "model",
      short: "m",
      description: "Model to use",
      defaultValue: () => "openai/gpt-4o-mini",
    }),
    apiKey: option({
      type: string,
      long: "api-key",
      short: "k",
      description: "OpenRouter API key (or set OPENROUTER_API_KEY in .env)",
      defaultValue: () => env.OPENROUTER_API_KEY ?? "",
    }),
    url: option({
      type: string,
      long: "url",
      short: "u",
      description: "API endpoint URL",
      defaultValue: () => "https://openrouter.ai/api/v1/chat/completions",
    }),
    raw: flag({
      long: "raw",
      short: "r",
      description: "Output raw uint8 bytes instead of text",
    }),
    line: flag({
      long: "line",
      short: "l",
      description: "Output line-wise messages with stats",
    }),
    data: flag({
      long: "data",
      short: "d",
      description: "Output parsed SSE data messages with stats",
    }),
    sse: flag({
      long: "sse",
      description: "Output validated SSE chunks with stats",
    }),
    delta: flag({
      long: "delta",
      description: "Output content deltas with stats",
    }),
    full: flag({
      long: "full",
      short: "f",
      description: "Output full accumulated content on end",
    }),
    block: flag({
      long: "block",
      short: "b",
      description: "Output block structure events (toplevel/code sections)",
    }),
    all: flag({
      long: "all",
      short: "a",
      description: "Output all events unfiltered",
    }),
    stats: flag({
      long: "stats",
      description: "Output stats messages (emitted on interval and stream end)",
    }),
    statsInterval: option({
      type: string,
      long: "stats-interval",
      description: "Stats collection interval in ms (default: 1000)",
      defaultValue: () => "1000",
    }),
    image: flag({
      long: "image",
      short: "i",
      description: "Output image events (block.image, image.begin/fragment/end)",
    }),
    imageDir: option({
      type: string,
      long: "image-dir",
      description: "Directory to save decoded images (enables image saving)",
      defaultValue: () => "",
    }),
  },
  handler: async ({
    prompt,
    src,
    model,
    apiKey,
    url,
    raw,
    line,
    data,
    sse,
    delta,
    full,
    block,
    all,
    stats,
    statsInterval,
    image,
    imageDir,
  }) => {
    let body: ReadableStream<Uint8Array>;

    if (src) {
      body = new ReadableStream({
        async start(controller) {
          const handle = await fs.open(src, "r");
          const buffer = new Uint8Array(64 * 1024);
          let bytesRead: number;
          while ((bytesRead = (await handle.read(buffer, 0, buffer.length)).bytesRead) > 0) {
            controller.enqueue(buffer.slice(0, bytesRead));
          }
          await handle.close();
          controller.close();
        },
      });
    } else {
      if (!apiKey) {
        console.error("Error: API key required. Use --api-key or set OPENROUTER_API_KEY in .env");
        process.exit(1);
      }

      if (!prompt) {
        console.error("Error: Prompt required. Use --prompt or --src");
        process.exit(1);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Error: ${response.status} - ${error}`);
        process.exit(1);
      }

      if (!response.body) {
        console.error("Error: No response body");
        process.exit(1);
      }

      body = response.body;
    }
    const sthis = ensureSuperThis();

    if (all || line || data || sse || delta || full || block || stats || image) {
      const streamId = sthis.nextId().str;
      const intervalMs = parseInt(statsInterval, 10) || 1000;
      const basePipeline = body
        .pipeThrough(createStatsCollector(streamId, intervalMs))
        .pipeThrough(createLineStream(streamId))
        .pipeThrough(createDataStream(streamId))
        .pipeThrough(createSseStream(streamId))
        .pipeThrough(createDeltaStream(streamId));

      const withFull = full || all ? basePipeline.pipeThrough(createFullStream(streamId)) : basePipeline;
      const withBlocks = withFull.pipeThrough(createLineStreamFromDelta(streamId, () => sthis.nextId().str));

      // Add image decode stream if image flag or imageDir is set
      const pipeline = image || imageDir ? withBlocks.pipeThrough(createImageDecodeStream(streamId)) : withBlocks;

      const reader = pipeline.getReader();

      // State for accumulating image fragments when saving
      const imageFragments = new Map<string, Uint8Array[]>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (all) {
          console.log(JSON.stringify(value));
        } else if (line && isLineMsg(value)) {
          console.log(JSON.stringify(value));
        } else if (data && isDataMsg(value)) {
          console.log(JSON.stringify(value));
        } else if (sse && isSseMsg(value)) {
          console.log(JSON.stringify(value));
        } else if (delta && isDeltaMsg(value)) {
          console.log(JSON.stringify(value));
        } else if (full && isFullMsg(value)) {
          console.log(JSON.stringify(value));
        } else if (block && isBlockOutput(value)) {
          console.log(JSON.stringify(value));
        } else if (image && (isBlockImage(value) || isImageDecodeMsg(value))) {
          console.log(JSON.stringify(value));
        }

        // Handle image saving inline
        if (imageDir) {
          if (isImageFragment(value)) {
            const existing = imageFragments.get(value.id) || [];
            existing.push(value.data);
            imageFragments.set(value.id, existing);
          } else if (isImageEnd(value)) {
            const fragments = imageFragments.get(value.id);
            if (fragments?.length) {
              const totalLength = fragments.reduce((sum, f) => sum + f.length, 0);
              const combined = new Uint8Array(totalLength);
              let offset = 0;
              for (const fragment of fragments) {
                combined.set(fragment, offset);
                offset += fragment.length;
              }
              const ext = mime.getExtension(value.mimetype) || "bin";
              const filepath = join(imageDir, `${value.id}.${ext}`);
              await fs.mkdir(imageDir, { recursive: true });
              await fs.writeFile(filepath, combined);
              imageFragments.delete(value.id);
            }
          }
        }

        if (stats &&
          (isStatsCollect(value) ||
            isLineStats(value) ||
            isDataStats(value) ||
            isSseStats(value) ||
            isDeltaStats(value) ||
            isFullStats(value) ||
            isBlockStats(value) ||
            isImageStats(value))
        ) {
          console.log(JSON.stringify(value));
        }
      }
    } else {
      const reader = body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (raw) {
          process.stdout.write(Buffer.from(value));
        } else {
          process.stdout.write(decoder.decode(value, { stream: true }));
        }
      }
    }
  },
});

run(app, process.argv.slice(2));
