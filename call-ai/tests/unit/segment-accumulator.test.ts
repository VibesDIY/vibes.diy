import { readFileSync } from "node:fs";

import {
  OpenRouterParser,
  CodeBlockParser,
  SegmentAccumulator,
  Segment,
} from "call-ai";
import { describe, it, expect } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

// Helper to create a full parser stack with accumulator
function createAccumulator() {
  const orParser = new OpenRouterParser();
  const codeParser = new CodeBlockParser(orParser);
  const accumulator = new SegmentAccumulator(codeParser);
  return { accumulator, orParser };
}

// Helper to simulate OpenRouter delta events directly
function simulateDelta(orParser: OpenRouterParser, content: string) {
  const chunk = {
    id: "test",
    provider: "Test",
    model: "test-model",
    created: Date.now(),
    choices: [{ delta: { content } }],
  };
  const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
  orParser.processChunk(sseData);
}

describe("SegmentAccumulator", () => {
  describe("basic functionality", () => {
    it("accumulates plain text into markdown segment", () => {
      const { accumulator, orParser } = createAccumulator();

      simulateDelta(orParser, "Hello ");
      simulateDelta(orParser, "world!");

      expect(accumulator.segments).toHaveLength(1);
      expect(accumulator.segments[0].type).toBe("markdown");
      expect(accumulator.segments[0].content).toBe("Hello world!");
    });

    it("creates markdown -> code -> markdown pattern", () => {
      const { accumulator, orParser } = createAccumulator();

      simulateDelta(orParser, "Here is code:\n```js\nconst x = 1;\n```\nDone!");

      expect(accumulator.segments).toHaveLength(3);
      expect(accumulator.segments[0].type).toBe("markdown");
      expect(accumulator.segments[1].type).toBe("code");
      expect(accumulator.segments[2].type).toBe("markdown");

      expect(accumulator.segments[0].content).toBe("Here is code:\n");
      expect(accumulator.segments[1].content).toBe("const x = 1;\n");
      expect(accumulator.segments[2].content).toBe("Done!");
    });

    it("accumulates code content across deltas", () => {
      const { accumulator, orParser } = createAccumulator();

      simulateDelta(orParser, "```js\nfunc");
      simulateDelta(orParser, "tion foo() {\n");
      simulateDelta(orParser, "  return 1;\n}\n```\n");

      expect(accumulator.segments).toHaveLength(1);
      expect(accumulator.segments[0].type).toBe("code");
      expect(accumulator.segments[0].content).toBe("function foo() {\n  return 1;\n}\n");
    });
  });

  describe("multiple code blocks", () => {
    it("handles multiple code blocks", () => {
      const { accumulator, orParser } = createAccumulator();

      simulateDelta(orParser, "First:\n```js\nconst a = 1;\n```\nSecond:\n```py\nx = 2\n```\nEnd");

      expect(accumulator.segments).toHaveLength(5);
      expect(accumulator.segments.map((s) => s.type)).toEqual([
        "markdown",
        "code",
        "markdown",
        "code",
        "markdown",
      ]);

      expect(accumulator.segments[1].content).toBe("const a = 1;\n");
      expect(accumulator.segments[3].content).toBe("x = 2\n");
    });
  });

  describe("segments array reference stability", () => {
    it("segments array is the same reference as content grows", () => {
      const { accumulator, orParser } = createAccumulator();
      const initialRef = accumulator.segments;

      simulateDelta(orParser, "Hello");
      expect(accumulator.segments).toBe(initialRef);

      simulateDelta(orParser, " world");
      expect(accumulator.segments).toBe(initialRef);

      simulateDelta(orParser, "\n```js\ncode\n```\n");
      expect(accumulator.segments).toBe(initialRef);
    });

    it("segment objects are mutated in place", () => {
      const { accumulator, orParser } = createAccumulator();

      simulateDelta(orParser, "Hello");
      const firstSegment = accumulator.segments[0];
      expect(firstSegment.content).toBe("Hello");

      simulateDelta(orParser, " world");
      expect(firstSegment.content).toBe("Hello world");
      expect(accumulator.segments[0]).toBe(firstSegment);
    });
  });

  describe("processChunk passthrough", () => {
    it("processChunk feeds through the parser stack", () => {
      const { accumulator } = createAccumulator();

      const chunk = {
        id: "test",
        provider: "Test",
        model: "test-model",
        created: Date.now(),
        choices: [{ delta: { content: "Hello!" } }],
      };
      accumulator.processChunk(`data: ${JSON.stringify(chunk)}\n\n`);

      expect(accumulator.segments).toHaveLength(1);
      expect(accumulator.segments[0].content).toBe("Hello!");
    });
  });

  describe("with fixtures (random chunking)", () => {
    it("accumulates segments from fireproof fixture", () => {
      const { accumulator } = createAccumulator();

      feedFixtureRandomly(accumulator, fireproofStreamFixture, { seed: 12345 });

      // The fireproof fixture should produce markdown and code segments
      expect(accumulator.segments.length).toBeGreaterThan(0);

      // Should have at least one code segment
      const codeSegments = accumulator.segments.filter((s: Segment) => s.type === "code");
      expect(codeSegments.length).toBeGreaterThan(0);

      // Code segments should have content
      for (const seg of codeSegments) {
        expect(seg.content.length).toBeGreaterThan(0);
      }
    });
  });
});
