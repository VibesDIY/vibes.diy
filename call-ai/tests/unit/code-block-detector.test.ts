import { describe, it, expect } from "vitest";
import { detectCodeBlocks } from "../../pkg/code-block-detector.js";
import { StreamTypes, StreamMessage } from "../../pkg/stream-messages.js";

// Helper to convert string or array of strings to AsyncIterable
async function* toAsyncIterable(input: string | string[]) {
  const chunks = Array.isArray(input) ? input : [input];
  for (const chunk of chunks) {
    yield chunk;
  }
}

// Helper to run detector and collect events
async function collectEvents(input: string | string[], streamId = 1) {
  const events: StreamMessage[] = [];
  const generator = detectCodeBlocks(toAsyncIterable(input), streamId, "test-model");

  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

describe("detectCodeBlocks Generator", () => {
  const streamId = 1;

  describe("single code block", () => {
    it("detects single code block with language", async () => {
      const events = await collectEvents("```ts\nconst x = 1;\n```\n");

      const types = events.map((e) => e.type);
      expect(types).toContain(StreamTypes.CODE_START);
      expect(types).toContain(StreamTypes.CODE_END);

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload).toMatchObject({
        streamId,
        language: "ts",
      });
    });

    it("detects code block without language", async () => {
      const events = await collectEvents("```\ncode here\n```\n");

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload).toMatchObject({
        streamId,
      });
      expect(startEvent?.payload.language).toBeUndefined();
    });

    it("extracts language with whitespace", async () => {
      const events = await collectEvents("```  javascript  \ncode\n```\n");

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload.language).toBe("javascript");
    });
  });

  describe("multiple code blocks", () => {
    it("handles multiple consecutive code blocks", async () => {
      const events = await collectEvents("```js\nfoo()\n```\n```py\nbar()\n```\n");

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);

      expect(starts.length).toBe(2);
      expect(ends.length).toBe(2);

      expect(starts[0].payload.language).toBe("js");
      expect(starts[1].payload.language).toBe("py");
    });

    it("handles code blocks with text between them", async () => {
      const events = await collectEvents("```js\na\n```\nsome text\n```py\nb\n```\n");

      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBeGreaterThan(0);

      // Should have text fragment containing "some text"
      const hasMiddleText = textFrags.some((e) => e.payload.frag.includes("some text"));
      expect(hasMiddleText).toBe(true);
    });
  });

  describe("streaming incremental chunks", () => {
    it("buffers incomplete fence markers", async () => {
      // Feed one character at a time
      const chunks = ["text before `", "`", "`ts\n"];
      const events = await collectEvents(chunks);

      // CODE_START should appear only after the fence is complete
      // We can't verify exact timing easily with full collection,
      // but we can verify correct final parsing.
      // To verify buffering, we rely on the fact that TEXT_FRAGMENTs
      // for buffered backticks appear before CODE_START if fence fails,
      // or disappear into fence if it succeeds.

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      expect(starts.length).toBe(1);
      expect(starts[0].payload.language).toBe("ts");
    });

    it("handles fence split across multiple chunks", async () => {
      const chunks = ["``", "`", "jsx\n", "code here", "\n```", "\n"];
      const events = await collectEvents(chunks);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);

      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
      expect(starts[0].payload.language).toBe("jsx");
    });
  });

  describe("mixed content", () => {
    it("emits text fragments before code block", async () => {
      const events = await collectEvents("Hello world\n```js\ncode\n```\n");

      const textEvents = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textEvents.length).toBeGreaterThan(0);

      const hasHello = textEvents.some((e) => e.payload.frag.includes("Hello"));
      expect(hasHello).toBe(true);
    });

    it("emits text fragments after code block", async () => {
      const events = await collectEvents("```js\ncode\n```\nGoodbye world");

      const textEvents = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      const hasGoodbye = textEvents.some((e) => e.payload.frag.includes("Goodbye"));
      expect(hasGoodbye).toBe(true);
    });

    it("handles text → code → text sequence", async () => {
      const events = await collectEvents("Before\n```js\ncode\n```\nAfter");

      const types = events.map((e) => e.type);

      const firstTextIdx = types.indexOf(StreamTypes.TEXT_FRAGMENT);
      const codeStartIdx = types.indexOf(StreamTypes.CODE_START);
      const codeEndIdx = types.indexOf(StreamTypes.CODE_END);
      const lastTextIdx = types.lastIndexOf(StreamTypes.TEXT_FRAGMENT);

      expect(firstTextIdx).toBeLessThan(codeStartIdx);
      expect(codeStartIdx).toBeLessThan(codeEndIdx);
      expect(codeEndIdx).toBeLessThan(lastTextIdx);
    });
  });

  describe("plain text only", () => {
    it("handles plain text without code blocks", async () => {
      const events = await collectEvents("Just some plain text without any code");

      expect(events.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
      expect(events.filter((e) => e.type === StreamTypes.CODE_END).length).toBe(0);
      expect(events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT).length).toBeGreaterThan(0);
    });

    it("handles text with single backticks (inline code)", async () => {
      const events = await collectEvents("Use `const` for constants");
      expect(events.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
    });

    it("handles text with double backticks", async () => {
      const events = await collectEvents("The ``escaped`` syntax");
      expect(events.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
    });
  });

  describe("finalize/incomplete blocks", () => {
    it("emits CODE_END if block incomplete at end of stream", async () => {
      const events = await collectEvents("```js\nincomplete code without closing fence");

      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);
      expect(ends.length).toBe(1);
    });

    it("flushes remaining text buffer at end", async () => {
      const events = await collectEvents("some text");
      const textEvents = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textEvents.length).toBeGreaterThan(0);
    });

    it("flushes remaining code buffer at end", async () => {
      const events = await collectEvents("```js\npartial code");
      // Should have both the code fragment and CODE_END
      const codeFrags = events.filter((e) => e.type === StreamTypes.CODE_FRAGMENT);
      const codeEnds = events.filter((e) => e.type === StreamTypes.CODE_END);

      expect(codeFrags.length).toBeGreaterThan(0);
      expect(codeEnds.length).toBe(1);
    });
  });

  describe("per-delta emission (chunk handling)", () => {
    it("emits TEXT_FRAGMENT for text deltas", async () => {
      const events = await collectEvents(["Hello ", "World"]);

      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBe(2);
      expect(textFrags[0].payload.frag).toBe("Hello ");
      expect(textFrags[1].payload.frag).toBe("World");
    });

    it("emits CODE_FRAGMENT for code deltas", async () => {
      const chunks = ["```js\n", "const x = 1;", "\nconst y = 2;"];
      const events = await collectEvents(chunks);

      const codeFrags = events.filter((e) => e.type === StreamTypes.CODE_FRAGMENT);
      expect(codeFrags.length).toBe(2);
      expect(codeFrags[0].payload.frag).toBe("const x = 1;");
      expect(codeFrags[1].payload.frag).toBe("\nconst y = 2;");
    });

    it("flushes buffered backticks when fence not confirmed", async () => {
      // Send partial backticks then non-backtick
      const events = await collectEvents(["``", "x"]);

      // Should emit ``x as text (likely in one or two fragments depending on implementation)
      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      const fullText = textFrags.map((e) => e.payload.frag).join("");
      expect(fullText).toBe("``x");
    });
  });

  describe("edge cases", () => {
    it("handles empty input", async () => {
      const events = await collectEvents("");
      // May produce 0 events or 1 empty text fragment depending on handling
      // Generator usually handles empty iterable by yielding nothing
      expect(events.length).toBe(0);
    });

    it("handles fence at very start", async () => {
      const events = await collectEvents("```js\ncode\n```\n");
      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      expect(starts.length).toBe(1);
    });

    it("handles backticks inside code block", async () => {
      const events = await collectEvents('```js\nconst s = "`";\n```\n');
      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);
      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
    });
  });
});
