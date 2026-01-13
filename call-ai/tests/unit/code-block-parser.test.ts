import { readFileSync } from "node:fs";

import {
  LineStreamParser,
  LineStreamState,
  SSEDataParser,
  JsonParser,
  OpenRouterParser,
  CodeBlockParser,
  CodeBlockEvent,
  TextFragmentEvent,
  CodeStartEvent,
  CodeFragmentEvent,
  CodeEndEvent,
} from "call-ai";
import { describe, it, expect } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

// Helper to create a full parser stack
function createCodeBlockParser() {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  const orParser = new OpenRouterParser(jsonParser);
  const codeParser = new CodeBlockParser(orParser);
  return { codeParser, orParser };
}

// Helper to simulate OpenRouter delta events directly
function simulateDelta(orParser: OpenRouterParser, content: string) {
  // Create a fake SSE data line with OpenRouter JSON structure
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

describe("CodeBlockParser", () => {
  describe("basic functionality", () => {
    it("emits text fragments for plain text", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      simulateDelta(orParser, "Hello world");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("textFragment");
      expect((events[0] as TextFragmentEvent).fragment).toBe("Hello world");
    });

    it("detects simple code block", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      simulateDelta(orParser, "Here is code:\n```js\nconst x = 1;\n```\nDone!");

      // Should have: text, codeStart, codeFragment, codeEnd, text
      const types = events.map((e) => e.type);
      expect(types).toContain("textFragment");
      expect(types).toContain("codeStart");
      expect(types).toContain("codeFragment");
      expect(types).toContain("codeEnd");

      const codeStart = events.find((e) => e.type === "codeStart") as CodeStartEvent;
      expect(codeStart.language).toBe("js");

      const codeFragments = events.filter((e) => e.type === "codeFragment") as CodeFragmentEvent[];
      const code = codeFragments.map((f) => f.fragment).join("");
      expect(code).toBe("const x = 1;\n");
    });

    it("extracts language from fence", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeStart") events.push(evt);
      });

      simulateDelta(orParser, "```typescript\ncode\n```\n");

      expect(events).toHaveLength(1);
      expect((events[0] as CodeStartEvent).language).toBe("typescript");
    });

    it("handles fence without language", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeStart") events.push(evt);
      });

      simulateDelta(orParser, "```\ncode\n```\n");

      expect(events).toHaveLength(1);
      expect((events[0] as CodeStartEvent).language).toBeUndefined();
    });
  });

  describe("streaming (split across deltas)", () => {
    it("handles fence split across deltas", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      simulateDelta(orParser, "Start `");
      simulateDelta(orParser, "``js\nx = 1;\n`");
      simulateDelta(orParser, "``\nEnd");

      const types = events.map((e) => e.type);
      expect(types).toContain("codeStart");
      expect(types).toContain("codeEnd");
    });

    it("handles code content split across deltas", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const codeFragments: string[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeFragment") codeFragments.push(evt.fragment);
      });

      simulateDelta(orParser, "```js\nfunc");
      simulateDelta(orParser, "tion foo() {\n");
      simulateDelta(orParser, "  return 1;\n}\n```\n");

      const code = codeFragments.join("");
      expect(code).toBe("function foo() {\n  return 1;\n}\n");
    });

    it("handles character-by-character streaming", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      const text = "```js\nx\n```\n";
      for (const char of text) {
        simulateDelta(orParser, char);
      }

      const types = events.map((e) => e.type);
      expect(types).toContain("codeStart");
      expect(types).toContain("codeFragment");
      expect(types).toContain("codeEnd");
    });
  });

  describe("multiple code blocks", () => {
    it("handles multiple code blocks in sequence", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const codeStarts: CodeStartEvent[] = [];
      const codeEnds: CodeEndEvent[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeStart") codeStarts.push(evt);
        if (evt.type === "codeEnd") codeEnds.push(evt);
      });

      simulateDelta(orParser, "```js\nfirst\n```\nText\n```py\nsecond\n```\n");

      expect(codeStarts).toHaveLength(2);
      expect(codeEnds).toHaveLength(2);
      expect(codeStarts[0].language).toBe("js");
      expect(codeStarts[1].language).toBe("py");
      // Each block should have unique blockId
      expect(codeStarts[0].blockId).not.toBe(codeStarts[1].blockId);
    });
  });

  describe("edge cases", () => {
    it("handles backticks in text (not fences)", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const textFragments: string[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "textFragment") textFragments.push(evt.fragment);
      });

      simulateDelta(orParser, "Use `code` inline");

      const text = textFragments.join("");
      expect(text).toBe("Use `code` inline");
    });

    it("handles double backticks", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const textFragments: string[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "textFragment") textFragments.push(evt.fragment);
      });

      simulateDelta(orParser, "Not a fence: ``");
      codeParser.finalize(); // Flush buffered backticks

      const text = textFragments.join("");
      expect(text).toBe("Not a fence: ``");
    });

    it("handles backticks inside code block", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const codeFragments: string[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeFragment") codeFragments.push(evt.fragment);
      });

      simulateDelta(orParser, "```js\nconst s = `template`;\n```\n");

      const code = codeFragments.join("");
      expect(code).toContain("`template`");
    });

    it("finalizes incomplete code block on finalize()", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      simulateDelta(orParser, "```js\nincomplete code");
      codeParser.finalize();

      const codeEnd = events.find((e) => e.type === "codeEnd");
      expect(codeEnd).toBeDefined();
    });

    it("auto-finalizes block when stream ends", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const ends: CodeEndEvent[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeEnd") ends.push(evt);
      });

      // Start a fence but do not close it in the payload
      simulateDelta(orParser, "```js\nconsole.log('hi');");
      // Signal stream end via OpenRouter -> Json -> SSE done event
      orParser.processChunk("data: [DONE]\n\n");

      expect(ends).toHaveLength(1);
    });
  });

  describe("sequence numbers", () => {
    it("assigns sequential seq numbers to events", () => {
      const { codeParser, orParser } = createCodeBlockParser();
      const events: CodeBlockEvent[] = [];
      codeParser.onEvent((evt) => events.push(evt));

      simulateDelta(orParser, "Text\n```js\ncode\n```\nMore");

      const seqs = events.map((e) => e.seq);
      // Verify they're sequential
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
      }
    });
  });

  describe("with fixtures (random chunking)", () => {
    it("parses code blocks from fireproof fixture", () => {
      const { codeParser } = createCodeBlockParser();
      const codeStarts: CodeStartEvent[] = [];
      const codeEnds: CodeEndEvent[] = [];
      codeParser.onEvent((evt) => {
        if (evt.type === "codeStart") codeStarts.push(evt);
        if (evt.type === "codeEnd") codeEnds.push(evt);
      });

      feedFixtureRandomly(codeParser, fireproofStreamFixture, { seed: 12345 });
      codeParser.finalize();

      // The fireproof fixture should contain at least one code block
      expect(codeStarts.length).toBeGreaterThan(0);
      expect(codeEnds.length).toBe(codeStarts.length);
    });
  });
});
