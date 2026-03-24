import { describe, it, expect, beforeAll } from "vitest";
import { isBlockEnd, isDeltaLine, isSseEnd, isSseError } from "./index.js";
import type { DeltaLineMsg, SseEndMsg } from "./index.js";
import {
  loadFixtureLines,
  parseCodeBlockJson,
  runDeltaPipeline,
  runFullPipeline,
  runSsePipeline,
} from "./test-helper.js";

// Fixtures captured via system-prompt approach (schema in system message,
// model responds with ```JSON code blocks). See fixtures/README.md.
const openRouterFixtures = [
  { name: "OpenRouter GPT", file: "openrouter-gpt.llm.txt" },
  { name: "OpenRouter Claude", file: "openrouter-claude.llm.txt" },
] as const;

// OpenAI Direct SSE lacks `provider` and `native_finish_reason` fields
// that SseChunk requires — tracked as a known gap.
// Anthropic Direct SSE uses event: prefix + content_block_delta format
// that SseChunk doesn't handle yet.

const fixtures = new Map<string, string[]>();

beforeAll(async () => {
  await Promise.all(
    openRouterFixtures.map(async ({ name, file }) => {
      fixtures.set(name, await loadFixtureLines(file));
    })
  );
  fixtures.set("OpenAI Direct", await loadFixtureLines("openai.llm.txt"));
  fixtures.set("Anthropic Direct", await loadFixtureLines("anthropic.llm.txt"));
});

function getFixtureLines(name: string): string[] {
  const lines = fixtures.get(name);
  if (lines === undefined) {
    throw new Error(`Fixture not found: ${name}`);
  }
  return lines;
}

function expectValidJson(value: unknown) {
  expect(value).toBeDefined();
  expect(typeof value).toBe("object");
  expect(value).not.toBeNull();
}

function expectSandwichShape(value: unknown) {
  expect(value).toHaveProperty("name");
  expect(value).toHaveProperty("layers");
  const parsed = value as { name: unknown; layers: unknown[] };
  expect(typeof parsed.name).toBe("string");
  expect(Array.isArray(parsed.layers)).toBe(true);
  expect(parsed.layers.length).toBeGreaterThan(0);
  for (const layer of parsed.layers) {
    expect(typeof layer).toBe("string");
  }
}

describe("OpenRouter fixtures (full pipeline)", () => {
  for (const { name } of openRouterFixtures) {
    it(`${name}: sse-stream parses without errors`, async () => {
      const res = await runSsePipeline(getFixtureLines(name));
      const errors = res.filter((event) => isSseError(event));
      const endEvents = res.filter((event): event is SseEndMsg => isSseEnd(event));

      expect(errors).toHaveLength(0);
      expect(endEvents).toHaveLength(1);
      expect(endEvents[0].totalChunks).toBeGreaterThan(0);
    });

    it(`${name}: full pipeline extracts valid JSON from code block`, async () => {
      const res = await runFullPipeline(getFixtureLines(name));
      const parsed = parseCodeBlockJson(res);
      expectValidJson(parsed);

      const blockEnds = res.filter((event) => isBlockEnd(event));
      expect(blockEnds.length).toBeGreaterThanOrEqual(1);
    });

    it(`${name}: delta-stream contains JSON content`, async () => {
      const res = await runDeltaPipeline(getFixtureLines(name));
      const fullText = res
        .filter((event): event is DeltaLineMsg => isDeltaLine(event))
        .map((event) => event.content)
        .join("");
      expect(fullText).toContain("```");
      expect(fullText).toContain('"name"');
    });
  }
});

// Claude returns the real sandwich in its last code block
describe("OpenRouter Claude sandwich shape", () => {
  it("last code block contains valid sandwich JSON", async () => {
    const res = await runFullPipeline(getFixtureLines("OpenRouter Claude"));
    const parsed = parseCodeBlockJson(res);
    expectSandwichShape(parsed);
  });
});

describe("OpenAI Direct (known SseChunk gap)", () => {
  it("SSE chunks fail validation (no provider/native_finish_reason)", async () => {
    const res = await runSsePipeline(getFixtureLines("OpenAI Direct"));
    const errors = res.filter((event) => isSseError(event));
    // OpenAI direct format lacks provider and native_finish_reason
    // that SseChunk arktype schema requires
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("Anthropic Direct (known SSE format gap)", () => {
  it("SSE chunks fail validation (event: prefix format)", async () => {
    const res = await runSsePipeline(getFixtureLines("Anthropic Direct"));
    const errors = res.filter((event) => isSseError(event));
    // Anthropic uses event: prefix lines and content_block_delta
    // that the current SSE parser doesn't handle
    expect(errors.length).toBeGreaterThan(0);
  });
});
