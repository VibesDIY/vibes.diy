import { array2stream, stream2array } from "@adviser/cement";
import { describe, it, expect } from "vitest";
import {
  createSectionsStream,
  isBlockEnd,
  isToplevelLine,
  isSseError,
  isSseEnd,
} from "./index.js";
import type { ToplevelLineMsg, SseEndMsg } from "./index.js";
import { createDataStream } from "./data-stream.js";
import { createDeltaStream } from "./delta-stream.js";
import { createLineStream } from "./line-stream.js";
import { createSseStream } from "./sse-stream.js";
import { createStatsCollector } from "./stats-stream.js";
import { lines as gptLines } from "./fixtures/openrouter-gpt-json-schema.js";
import { lines as claudeLines } from "./fixtures/openrouter-claude-json-schema.js";

function runFullPipeline(lines: string[]) {
  let id = 1;
  const streamId = `test-${id++}`;
  return stream2array(
    array2stream(lines.map((i) => i + "\n"))
      .pipeThrough(createStatsCollector(streamId, 5000))
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId))
      .pipeThrough(createDeltaStream(streamId, () => `test-${id++}`))
      .pipeThrough(createSectionsStream(streamId, () => `test-${id++}`))
  );
}

function runSsePipeline(lines: string[]) {
  let id = 1;
  const streamId = `test-${id++}`;
  return stream2array(
    array2stream(lines.map((i) => i + "\n"))
      .pipeThrough(createStatsCollector(streamId, 5000))
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId))
  );
}

describe("OpenRouter GPT-4o-mini with json_schema", () => {
  it("sse-stream accepts all chunks without errors", async () => {
    const res = await runSsePipeline(gptLines);
    const errors = res.filter((i) => isSseError(i));
    const endEvents = res.filter((i): i is SseEndMsg => isSseEnd(i));

    expect(errors.length).toBe(0);
    expect(endEvents.length).toBe(1);
    expect(endEvents[0].totalChunks).toBeGreaterThan(0);
  });

  it("full pipeline produces valid sandwich JSON", async () => {
    const res = await runFullPipeline(gptLines);
    const textLines = res.filter((i): i is ToplevelLineMsg => isToplevelLine(i)).map((i) => i.line);
    const text = textLines.join("\n");

    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("layers");
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.layers)).toBe(true);
    expect(parsed.layers.length).toBeGreaterThan(0);

    const endEvents = res.filter((i) => isBlockEnd(i));
    expect(endEvents.length).toBe(1);
  });
});

describe("OpenRouter Claude with json_schema", () => {
  it("sse-stream accepts all chunks without errors", async () => {
    const res = await runSsePipeline(claudeLines);
    const errors = res.filter((i) => isSseError(i));
    const endEvents = res.filter((i): i is SseEndMsg => isSseEnd(i));

    expect(errors.length).toBe(0);
    expect(endEvents.length).toBe(1);
    expect(endEvents[0].totalChunks).toBeGreaterThan(0);
  });

  it("full pipeline produces valid sandwich JSON", async () => {
    const res = await runFullPipeline(claudeLines);
    const textLines = res.filter((i): i is ToplevelLineMsg => isToplevelLine(i)).map((i) => i.line);
    const text = textLines.join("\n");

    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("name");
    expect(parsed).toHaveProperty("layers");
    expect(typeof parsed.name).toBe("string");
    expect(Array.isArray(parsed.layers)).toBe(true);
    expect(parsed.layers.length).toBeGreaterThan(0);

    const endEvents = res.filter((i) => isBlockEnd(i));
    expect(endEvents.length).toBe(1);
  });
});
