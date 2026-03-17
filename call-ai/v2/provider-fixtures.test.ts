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

const fixtureConfigs = [
  { name: "OpenRouter GPT (codeblock)", file: "openrouter-gpt-codeblock.llm.txt" },
  { name: "OpenRouter Claude (codeblock)", file: "openrouter-claude-codeblock.llm.txt" },
  { name: "OpenAI Direct (codeblock)", file: "openai-codeblock.llm.txt" },
  { name: "Anthropic Direct (codeblock)", file: "anthropic-codeblock.llm.txt" },
] as const;

const fixtures = new Map<string, string[]>();

beforeAll(async () => {
  await Promise.all(
    fixtureConfigs.map(async ({ name, file }) => {
      fixtures.set(name, await loadFixtureLines(file));
    })
  );
});

function getFixtureLines(name: string): string[] {
  const lines = fixtures.get(name);
  if (lines === undefined) {
    throw new Error(`Fixture not found: ${name}`);
  }
  return lines;
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

describe("captured provider fixtures", () => {
  for (const { name } of fixtureConfigs) {
    it(`${name}: sse-stream accepts chunks without errors`, async () => {
      const res = await runSsePipeline(getFixtureLines(name));
      const errors = res.filter((event) => isSseError(event));
      const endEvents = res.filter((event): event is SseEndMsg => isSseEnd(event));

      expect(errors).toHaveLength(0);
      expect(endEvents).toHaveLength(1);
      expect(endEvents[0].totalChunks).toBeGreaterThan(0);
    });

    it(`${name}: full pipeline emits one block and valid sandwich JSON`, async () => {
      const res = await runFullPipeline(getFixtureLines(name));
      const parsed = parseCodeBlockJson(res);
      expectSandwichShape(parsed);

      const blockEnds = res.filter((event) => isBlockEnd(event));
      expect(blockEnds).toHaveLength(1);
    });

    it(`${name}: delta-stream reconstructs valid JSON`, async () => {
      const res = await runDeltaPipeline(getFixtureLines(name));
      // Deltas include the ```JSON fences; extract just the JSON body
      const fullText = res
        .filter((event): event is DeltaLineMsg => isDeltaLine(event))
        .map((event) => event.content)
        .join("");
      const jsonText = fullText.match(/```(?:json|JSON)\n([\s\S]*?)\n```/)?.[1] ?? fullText;
      expect(jsonText).toContain('"name"');
      const parsed = JSON.parse(jsonText);
      expectSandwichShape(parsed);
    });
  }
});
