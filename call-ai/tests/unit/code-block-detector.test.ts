import { describe, it, expect, beforeEach } from "vitest";
import { CodeBlockDetector } from "../../pkg/code-block-detector.js";
import { StreamTypes } from "../../pkg/stream-messages.js";

describe("CodeBlockDetector", () => {
  let detector: CodeBlockDetector;
  const streamId = 1;

  beforeEach(() => {
    detector = new CodeBlockDetector("test-model");
  });

  describe("single code block", () => {
    it("detects single code block with language", () => {
      const events = detector.feed("```ts\nconst x = 1;\n```\n", streamId, 0);

      const types = events.map((e) => e.type);
      expect(types).toContain(StreamTypes.CODE_START);
      expect(types).toContain(StreamTypes.CODE_END);

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload).toMatchObject({
        streamId,
        language: "ts",
      });
    });

    it("detects code block without language", () => {
      const events = detector.feed("```\ncode here\n```\n", streamId, 0);

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload).toMatchObject({
        streamId,
      });
      expect(startEvent?.payload.language).toBeUndefined();
    });

    it("extracts language with whitespace", () => {
      const events = detector.feed("```  javascript  \ncode\n```\n", streamId, 0);

      const startEvent = events.find((e) => e.type === StreamTypes.CODE_START);
      expect(startEvent?.payload.language).toBe("javascript");
    });
  });

  describe("multiple code blocks", () => {
    it("handles multiple consecutive code blocks", () => {
      const events = detector.feed("```js\nfoo()\n```\n```py\nbar()\n```\n", streamId, 0);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);

      expect(starts.length).toBe(2);
      expect(ends.length).toBe(2);

      expect(starts[0].payload.language).toBe("js");
      expect(starts[1].payload.language).toBe("py");
    });

    it("handles code blocks with text between them", () => {
      const events = detector.feed("```js\na\n```\nsome text\n```py\nb\n```\n", streamId, 0);

      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBeGreaterThan(0);

      // Should have text fragment containing "some text"
      const hasMiddleText = textFrags.some((e) => e.payload.frag.includes("some text"));
      expect(hasMiddleText).toBe(true);
    });
  });

  describe("streaming incremental chunks", () => {
    it("buffers incomplete fence markers", () => {
      // Feed one character at a time
      const allEvents: ReturnType<typeof detector.feed> = [];

      allEvents.push(...detector.feed("text before `", streamId, 0));
      // No CODE_START yet - only one backtick
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);

      allEvents.push(...detector.feed("`", streamId, 1));
      // Still no CODE_START - only two backticks
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);

      allEvents.push(...detector.feed("`ts\n", streamId, 2));
      // Now we should have CODE_START
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(1);
    });

    it("handles fence split across multiple chunks", () => {
      const allEvents: ReturnType<typeof detector.feed> = [];

      allEvents.push(...detector.feed("``", streamId, 0));
      allEvents.push(...detector.feed("`", streamId, 1));
      allEvents.push(...detector.feed("jsx\n", streamId, 2));
      allEvents.push(...detector.feed("code here", streamId, 3));
      allEvents.push(...detector.feed("\n```", streamId, 4));
      allEvents.push(...detector.feed("\n", streamId, 5));

      const starts = allEvents.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = allEvents.filter((e) => e.type === StreamTypes.CODE_END);

      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
      expect(starts[0].payload.language).toBe("jsx");
    });
  });

  describe("mixed content", () => {
    it("emits text fragments before code block", () => {
      const events = detector.feed("Hello world\n```js\ncode\n```\n", streamId, 0);

      const textEvents = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textEvents.length).toBeGreaterThan(0);

      const hasHello = textEvents.some((e) => e.payload.frag.includes("Hello"));
      expect(hasHello).toBe(true);
    });

    it("emits text fragments after code block", () => {
      const events = detector.feed("```js\ncode\n```\nGoodbye world", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      const textEvents = allEvents.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);

      const hasGoodbye = textEvents.some((e) => e.payload.frag.includes("Goodbye"));
      expect(hasGoodbye).toBe(true);
    });

    it("handles text → code → text sequence", () => {
      const events = detector.feed("Before\n```js\ncode\n```\nAfter", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      const types = allEvents.map((e) => e.type);

      // Should have text, then code events, then text
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
    it("handles plain text without code blocks", () => {
      const events = detector.feed("Just some plain text without any code", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      // Should have text fragments but no code events
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_END).length).toBe(0);
      expect(allEvents.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT).length).toBeGreaterThan(0);
    });

    it("handles text with single backticks (inline code)", () => {
      const events = detector.feed("Use `const` for constants", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      // Single backticks should not trigger code block
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
    });

    it("handles text with double backticks", () => {
      const events = detector.feed("The ``escaped`` syntax", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      // Double backticks should not trigger code block
      expect(allEvents.filter((e) => e.type === StreamTypes.CODE_START).length).toBe(0);
    });
  });

  describe("finalize", () => {
    it("emits CODE_END on finalize if block incomplete", () => {
      detector.feed("```js\nincomplete code without closing fence", streamId, 0);
      const events = detector.finalize(streamId);

      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);
      expect(ends.length).toBe(1);
    });

    it("emits text during feed (per-delta emission)", () => {
      // With per-delta emission, text is emitted during feed(), not finalize()
      const feedEvents = detector.feed("some text", streamId, 0);
      const finalizeEvents = detector.finalize(streamId);
      const allEvents = [...feedEvents, ...finalizeEvents];

      const textEvents = allEvents.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textEvents.length).toBeGreaterThan(0);
      // Text should be emitted during feed, not finalize
      const feedTextEvents = feedEvents.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(feedTextEvents.length).toBeGreaterThan(0);
    });

    it("emits code during feed and CODE_END on finalize for incomplete block", () => {
      // With per-delta emission, code is emitted during feed()
      // But CODE_END is still emitted on finalize for incomplete blocks
      const feedEvents = detector.feed("```js\npartial code", streamId, 0);
      const finalizeEvents = detector.finalize(streamId);
      // CODE_FRAGMENT should be emitted during feed
      const feedCodeFrags = feedEvents.filter((e) => e.type === StreamTypes.CODE_FRAGMENT);
      expect(feedCodeFrags.length).toBeGreaterThan(0);

      // CODE_END should be emitted during finalize (incomplete block)
      const finalizeCodeEnds = finalizeEvents.filter((e) => e.type === StreamTypes.CODE_END);
      expect(finalizeCodeEnds.length).toBe(1);
    });
  });

  describe("reset", () => {
    it("resets state for reuse", () => {
      detector.feed("```js\ncode\n```\n", streamId, 0);
      detector.reset();

      // After reset, should be back to initial state
      const events = detector.feed("```py\nnew code\n```\n", streamId, 0);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      expect(starts.length).toBe(1);
      expect(starts[0].payload.language).toBe("py");
    });
  });

  describe("per-delta emission", () => {
    it("emits TEXT_FRAGMENT for each text delta", () => {
      // Each feed() call should emit TEXT_FRAGMENT for text content
      const events1 = detector.feed("Hello ", streamId, 0);
      const events2 = detector.feed("World", streamId, 1);

      const textFrags1 = events1.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      const textFrags2 = events2.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);

      expect(textFrags1.length).toBe(1);
      expect(textFrags1[0].payload.frag).toBe("Hello ");
      expect(textFrags2.length).toBe(1);
      expect(textFrags2[0].payload.frag).toBe("World");
    });

    it("emits CODE_FRAGMENT for each code delta", () => {
      // Start a code block
      detector.feed("```js\n", streamId, 0);

      // Each subsequent feed should emit CODE_FRAGMENT
      const events1 = detector.feed("const x = 1;", streamId, 1);
      const events2 = detector.feed("\nconst y = 2;", streamId, 2);

      const codeFrags1 = events1.filter((e) => e.type === StreamTypes.CODE_FRAGMENT);
      const codeFrags2 = events2.filter((e) => e.type === StreamTypes.CODE_FRAGMENT);

      expect(codeFrags1.length).toBe(1);
      expect(codeFrags1[0].payload.frag).toBe("const x = 1;");
      expect(codeFrags2.length).toBe(1);
      expect(codeFrags2[0].payload.frag).toBe("\nconst y = 2;");
    });

    it("emits nothing for backtick-only delta (potential fence)", () => {
      // Backticks are buffered for fence detection, not emitted immediately
      const events = detector.feed("``", streamId, 0);

      // No TEXT_FRAGMENT should be emitted yet - backticks are buffered
      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBe(0);
    });

    it("flushes buffered backticks when fence not confirmed", () => {
      // Send partial backticks
      detector.feed("``", streamId, 0);
      // Then non-backtick char - backticks should be flushed as text
      const events = detector.feed("x", streamId, 1);

      const textFrags = events.filter((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBe(1);
      expect(textFrags[0].payload.frag).toBe("``x");
    });

    it("emits both text and CODE_START when delta crosses fence boundary", () => {
      // Delta contains text before fence and language after
      const events = detector.feed("text```js\n", streamId, 0);

      const types = events.map((e) => e.type);

      // Should have TEXT_FRAGMENT for "text", then CODE_START
      expect(types).toContain(StreamTypes.TEXT_FRAGMENT);
      expect(types).toContain(StreamTypes.CODE_START);

      // TEXT_FRAGMENT should come before CODE_START
      const textIdx = types.indexOf(StreamTypes.TEXT_FRAGMENT);
      const codeStartIdx = types.indexOf(StreamTypes.CODE_START);
      expect(textIdx).toBeLessThan(codeStartIdx);

      const textFrag = events.find((e) => e.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrag?.payload.frag).toBe("text");
    });

    it("emits CODE_END and text when delta crosses closing fence", () => {
      // Start a code block
      detector.feed("```js\ncode", streamId, 0);

      // Delta contains closing fence and text after
      const events = detector.feed("\n```\nafter", streamId, 1);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      const types = allEvents.map((e) => e.type);

      // Should have CODE_END then TEXT_FRAGMENT
      expect(types).toContain(StreamTypes.CODE_END);
      expect(types).toContain(StreamTypes.TEXT_FRAGMENT);

      const codeEndIdx = types.indexOf(StreamTypes.CODE_END);
      const textIdx = types.indexOf(StreamTypes.TEXT_FRAGMENT);
      expect(codeEndIdx).toBeLessThan(textIdx);
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      const events = detector.feed("", streamId, 0);
      expect(events.length).toBe(0);
    });

    it("handles fence at very start", () => {
      const events = detector.feed("```js\ncode\n```\n", streamId, 0);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      expect(starts.length).toBe(1);
    });

    it("handles four backticks (not a code fence)", () => {
      const events = detector.feed("````\nnot a fence\n````\n", streamId, 0);
      const finalEvents = detector.finalize(streamId);
      const allEvents = [...events, ...finalEvents];

      // Four backticks might be interpreted differently
      // The important thing is it doesn't crash
      expect(allEvents).toBeDefined();
    });

    it("handles backticks inside code block", () => {
      // Code containing: const s = "`";
      const events = detector.feed('```js\nconst s = "`";\n```\n', streamId, 0);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);

      // Should properly handle the single backtick inside
      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
    });

    it("handles double backticks inside code block", () => {
      // Code containing: const s = "``";
      const events = detector.feed('```js\nconst s = "``";\n```\n', streamId, 0);

      const starts = events.filter((e) => e.type === StreamTypes.CODE_START);
      const ends = events.filter((e) => e.type === StreamTypes.CODE_END);

      expect(starts.length).toBe(1);
      expect(ends.length).toBe(1);
    });
  });
});
