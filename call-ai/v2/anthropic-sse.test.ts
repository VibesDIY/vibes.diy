import { array2stream, stream2array } from "@adviser/cement";
import { describe, it, expect } from "vitest";
import {
  createSectionsStream,
  isBlockEnd,
  isToplevelLine,
  isSseError,
  isSseEnd,
  isDeltaLine,
} from "./index.js";
import type { ToplevelLineMsg, DeltaLineMsg, SseEndMsg } from "./index.js";
import { createDataStream } from "./data-stream.js";
import { createDeltaStream } from "./delta-stream.js";
import { createLineStream } from "./line-stream.js";
import { createSseStream } from "./sse-stream.js";
import { createStatsCollector } from "./stats-stream.js";
import { lines as anthropicSseLines } from "./fixtures/anthropic-schema-stream.js";

describe("anthropic SSE format through v2 pipeline", () => {
  it("full pipeline produces valid sandwich JSON from Anthropic SSE", async () => {
    let id = 1;
    const streamId = `test-${id++}`;
    const res = await stream2array(
      array2stream(anthropicSseLines.map((i) => i + "\n"))
        .pipeThrough(createStatsCollector(streamId, 5000))
        .pipeThrough(createLineStream(streamId))
        .pipeThrough(createDataStream(streamId))
        .pipeThrough(createSseStream(streamId))
        .pipeThrough(createDeltaStream(streamId, () => `test-${id++}`))
        .pipeThrough(createSectionsStream(streamId, () => `test-${id++}`))
    );

    const textLines = res.filter((i): i is ToplevelLineMsg => isToplevelLine(i)).map((i) => i.line);
    const text = textLines.join("\n");

    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("layers");
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.layers)).toBe(true);
    expect(parsed.layers.length).toBeGreaterThan(0);
    for (const layer of parsed.layers) {
      expect(typeof layer).toBe("string");
    }

    const endEvents = res.filter((i) => isBlockEnd(i));
    expect(endEvents.length).toBe(1);
  });

  it("delta-stream produces correct content from Anthropic SSE", async () => {
    let id = 1;
    const streamId = `test-${id++}`;
    const res = await stream2array(
      array2stream(anthropicSseLines.map((i) => i + "\n"))
        .pipeThrough(createStatsCollector(streamId, 5000))
        .pipeThrough(createLineStream(streamId))
        .pipeThrough(createDataStream(streamId))
        .pipeThrough(createSseStream(streamId))
        .pipeThrough(createDeltaStream(streamId, () => `test-${id++}`))
    );

    const deltaLines = res.filter((i): i is DeltaLineMsg => isDeltaLine(i));
    const fullText = deltaLines.map((d) => d.content).join("");

    expect(fullText).toContain('{"name"');
    const parsed = JSON.parse(fullText);
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("layers");
  });

  it("sse-stream translates Anthropic events into valid SseChunks", async () => {
    let id = 1;
    const streamId = `test-${id++}`;
    const res = await stream2array(
      array2stream(anthropicSseLines.map((i) => i + "\n"))
        .pipeThrough(createStatsCollector(streamId, 5000))
        .pipeThrough(createLineStream(streamId))
        .pipeThrough(createDataStream(streamId))
        .pipeThrough(createSseStream(streamId))
    );

    const errors = res.filter((i) => isSseError(i));
    const endEvents = res.filter((i): i is SseEndMsg => isSseEnd(i));

    expect(errors.length).toBe(0);
    expect(endEvents.length).toBe(1);
    expect(endEvents[0].totalChunks).toBeGreaterThan(0);
  });
});
