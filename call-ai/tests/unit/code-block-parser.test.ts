import { readFileSync } from "node:fs";

import {
  OpenRouterParser,
  CodeBlockEvent,
  TextFragmentEvent,
  CodeStartEvent,
  CodeFragmentEvent,
  CodeEndEvent,
} from "call-ai";
import { describe, it, expect } from "vitest";
import { createCodeBlockHandler } from "../../pkg/parser/handlers/code-block-handler.js";
import { ParserEvento } from "../../pkg/parser/parser-evento.js";

import { feedFixtureRandomly } from "./test-utils.js";

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

// Helper to create a full parser stack
function createParserStack() {
  const orParser = new OpenRouterParser();
  orParser.register(createCodeBlockHandler());
  return orParser;
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

// Helper to flush buffer by sending stream end
function finalizeParser(orParser: OpenRouterParser) {
  orParser.processChunk("data: [DONE]\n\n");
}

describe("CodeBlockHandler", () => {
  describe("basic functionality", () => {
    it("emits text fragments for plain text", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "textFragment") events.push(evt as TextFragmentEvent);
      });

      simulateDelta(orParser, "Hello world");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("textFragment");
      expect((events[0] as TextFragmentEvent).fragment).toBe("Hello world");
    });

    it("detects simple code block", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (["textFragment", "codeStart", "codeFragment", "codeEnd"].includes(evt.type)) {
          events.push(evt as CodeBlockEvent);
        }
      });

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
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeStart") events.push(evt as CodeStartEvent);
      });

      simulateDelta(orParser, "```typescript\ncode\n```\n");

      expect(events).toHaveLength(1);
      expect((events[0] as CodeStartEvent).language).toBe("typescript");
    });

    it("handles fence without language", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeStart") events.push(evt as CodeStartEvent);
      });

      simulateDelta(orParser, "```\ncode\n```\n");

      expect(events).toHaveLength(1);
      expect((events[0] as CodeStartEvent).language).toBeUndefined();
    });
  });

  describe("streaming (split across deltas)", () => {
    it("handles fence split across deltas", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
         if (["codeStart", "codeEnd"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

      simulateDelta(orParser, "Start `");
      simulateDelta(orParser, "``js\nx = 1;\n`");
      simulateDelta(orParser, "``\nEnd");

      const types = events.map((e) => e.type);
      expect(types).toContain("codeStart");
      expect(types).toContain("codeEnd");
    });

    it("handles code content split across deltas", () => {
      const orParser = createParserStack();
      const codeFragments: string[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeFragment") codeFragments.push((evt as CodeFragmentEvent).fragment);
      });

      simulateDelta(orParser, "```js\nfunc");
      simulateDelta(orParser, "tion foo() {\n");
      simulateDelta(orParser, "  return 1;\n}\n```\n");

      const code = codeFragments.join("");
      expect(code).toBe("function foo() {\n  return 1;\n}\n");
    });

    it("handles character-by-character streaming", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
         if (["codeStart", "codeFragment", "codeEnd"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

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
      const orParser = createParserStack();
      const codeStarts: CodeStartEvent[] = [];
      const codeEnds: CodeEndEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeStart") codeStarts.push(evt as CodeStartEvent);
        if (evt.type === "codeEnd") codeEnds.push(evt as CodeEndEvent);
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
      const orParser = createParserStack();
      const textFragments: string[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "textFragment") textFragments.push((evt as TextFragmentEvent).fragment);
      });

      simulateDelta(orParser, "Use `code` inline");

      const text = textFragments.join("");
      expect(text).toBe("Use `code` inline");
    });

    it("handles double backticks", () => {
      const orParser = createParserStack();
      const textFragments: string[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "textFragment") textFragments.push((evt as TextFragmentEvent).fragment);
      });

      simulateDelta(orParser, "Not a fence: ``");
      finalizeParser(orParser); // Flush buffered backticks

      const text = textFragments.join("");
      expect(text).toBe("Not a fence: ``");
    });

    it("handles backticks inside code block", () => {
      const orParser = createParserStack();
      const codeFragments: string[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeFragment") codeFragments.push((evt as CodeFragmentEvent).fragment);
      });

      simulateDelta(orParser, "```js\nconst s = `template`;\n```\n");

      const code = codeFragments.join("");
      expect(code).toContain("`template`");
    });

    it("finalizes incomplete code block on finalize()", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
         if (["codeEnd"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

      simulateDelta(orParser, "```js\nincomplete code");
      finalizeParser(orParser);

      const codeEnd = events.find((e) => e.type === "codeEnd");
      expect(codeEnd).toBeDefined();
    });

    it("auto-finalizes block when stream ends", () => {
      const orParser = createParserStack();
      const ends: CodeEndEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeEnd") ends.push(evt as CodeEndEvent);
      });

      // Start a fence but do not close it in the payload
      simulateDelta(orParser, "```js\nconsole.log('hi');");
      // Signal stream end via OpenRouter -> Json -> SSE done event
      orParser.processChunk("data: [DONE]\n\n");

      expect(ends).toHaveLength(1);
    });

    it("handles closing fence with trailing spaces before newline", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (["codeStart", "codeEnd", "textFragment"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

      // Closing fence with trailing spaces: ```   \n
      simulateDelta(orParser, "```js\ncode\n```   \nMore text");

      const types = events.map((e) => e.type);
      expect(types).toContain("codeStart");
      expect(types).toContain("codeEnd");
      // Should have text after code block
      const textAfter = events.filter(
        (e) => e.type === "textFragment" && (e as TextFragmentEvent).fragment.includes("More text"),
      );
      expect(textAfter.length).toBeGreaterThan(0);
    });

    it("handles closing fence with CRLF line ending", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
        if (["codeStart", "codeEnd", "textFragment"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

      // Closing fence with CRLF: ```\r\n
      simulateDelta(orParser, "```js\ncode\n```\r\nMore text");

      const types = events.map((e) => e.type);
      expect(types).toContain("codeStart");
      expect(types).toContain("codeEnd");
      // Should have text after code block (may include the \r in "More text")
      const textAfter = events.filter(
        (e) => e.type === "textFragment" && (e as TextFragmentEvent).fragment.includes("More text"),
      );
      expect(textAfter.length).toBeGreaterThan(0);
    });
  });

  describe("sequence numbers", () => {
    it("assigns sequential seq numbers to events", () => {
      const orParser = createParserStack();
      const events: CodeBlockEvent[] = [];
      orParser.onEvent((evt) => {
         if (["codeStart", "codeFragment", "codeEnd", "textFragment"].includes(evt.type)) events.push(evt as CodeBlockEvent);
      });

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
      const orParser = createParserStack();
      const codeStarts: CodeStartEvent[] = [];
      const codeEnds: CodeEndEvent[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "codeStart") codeStarts.push(evt as CodeStartEvent);
        if (evt.type === "codeEnd") codeEnds.push(evt as CodeEndEvent);
      });

      feedFixtureRandomly(orParser, fireproofStreamFixture, { seed: 12345 });
      finalizeParser(orParser);

      // The fireproof fixture should contain at least one code block
      expect(codeStarts.length).toBeGreaterThan(0);
      expect(codeEnds.length).toBe(codeStarts.length);
    });
  });
});
