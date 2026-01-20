import { describe, it, expect, vi } from "vitest";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import {
  lineEvent,
  LineEvent,
  isLineEventError,
  LineFragment,
  LineBracketOpen,
  LineBracketClose,
  LineContent,
} from "@vibes.diy/call-ai-base";

describe("LineStreamParser arktype events", () => {
  describe("WaitingForEOL mode (fragment events)", () => {
    function createParser() {
      return new LineStreamParser(LineStreamState.WaitingForEOL);
    }

    it("should emit line.fragment events via onEvent", () => {
      const parser = createParser();
      const events = vi.fn();
      parser.onEvent(events);

      parser.processChunk("hello\n");

      expect(events).toHaveBeenCalled();
      const fragmentEvents = events.mock.calls.filter((c) => c[0].type === "line.fragment");
      expect(fragmentEvents.length).toBeGreaterThan(0);

      const evt = fragmentEvents.find((c) => c[0].lineComplete)?.[0];
      expect(evt).toMatchObject({
        type: "line.fragment",
        lineNr: expect.any(Number),
        seq: expect.any(Number),
        lineComplete: true,
      });

      // Validate with arktype
      const result = lineEvent(evt);
      expect(isLineEventError(result)).toBe(false);
    });

    it("should emit incomplete fragments for partial lines", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk("partial");

      const fragments = events.filter((e) => e.type === "line.fragment") as LineFragment[];
      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments[0].lineComplete).toBe(false);
    });

    it("should emit complete fragment when newline arrives", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk("first");
      parser.processChunk(" line\n");

      const completeFragments = events.filter((e) => e.type === "line.fragment" && (e as LineFragment).lineComplete);
      expect(completeFragments.length).toBe(1);
    });

    it("should track line numbers across multiple lines", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk("line1\nline2\n");

      const completeFragments = events.filter(
        (e) => e.type === "line.fragment" && (e as LineFragment).lineComplete,
      ) as LineFragment[];
      expect(completeFragments.length).toBe(2);
      // First complete fragment is line 0, second is line 1
      expect(completeFragments[0].lineNr).toBe(0);
      expect(completeFragments[1].lineNr).toBe(1);
    });

    it("should validate all fragment events with arktype", () => {
      const parser = createParser();
      const events: LineEvent[] = [];

      parser.onEvent((evt) => {
        const result = lineEvent(evt);
        if (isLineEventError(result)) {
          throw new Error(`Invalid event: ${JSON.stringify(result)}`);
        }
        events.push(evt);
      });

      parser.processChunk("data: test\n\nanother line\n");

      expect(events.length).toBeGreaterThan(0);
      events.forEach((evt) => {
        expect(evt.type).toBe("line.fragment");
      });
    });
  });

  describe("WaitForOpeningCurlyBracket mode (bracket events)", () => {
    function createParser() {
      return new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
    }

    it("should emit line.bracket.open when { is found", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk('{ "key": "value" }');

      const openEvents = events.filter((e) => e.type === "line.bracket.open") as LineBracketOpen[];
      expect(openEvents.length).toBe(1);

      // Validate with arktype
      const result = lineEvent(openEvents[0]);
      expect(isLineEventError(result)).toBe(false);
    });

    it("should emit line.bracket.close when } closes the block", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk('{ "key": "value" }');

      const closeEvents = events.filter((e) => e.type === "line.bracket.close") as LineBracketClose[];
      expect(closeEvents.length).toBe(1);

      // Validate with arktype
      const result = lineEvent(closeEvents[0]);
      expect(isLineEventError(result)).toBe(false);
    });

    it("should emit line.content events for content within brackets", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk('{ "key": "value" }');

      const contentEvents = events.filter((e) => e.type === "line.content") as LineContent[];
      expect(contentEvents.length).toBeGreaterThan(0);

      // Should have at least a "last" event (emitted before closing bracket)
      const last = contentEvents.find((e) => e.seqStyle === "last");
      expect(last).toBeDefined();
      expect(last!.content).toContain('"key"');
    });

    it("should handle nested brackets correctly", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk('{ "outer": { "inner": 1 } }');

      // Should have one open for outer, one for inner, and matching closes
      const openEvents = events.filter((e) => e.type === "line.bracket.open");
      const closeEvents = events.filter((e) => e.type === "line.bracket.close");
      // Only the outermost open/close are emitted as bracket events
      // Inner brackets are part of the content
      expect(openEvents.length).toBe(1);
      expect(closeEvents.length).toBe(1);
    });

    it("should validate all bracket events with arktype", () => {
      const parser = createParser();
      const events: LineEvent[] = [];

      parser.onEvent((evt) => {
        const result = lineEvent(evt);
        if (isLineEventError(result)) {
          throw new Error(`Invalid event: ${JSON.stringify(evt)}`);
        }
        events.push(evt);
      });

      parser.processChunk('{ "test": 123 }');

      expect(events.length).toBeGreaterThan(0);
      const types = events.map((e) => e.type);
      expect(types).toContain("line.bracket.open");
      expect(types).toContain("line.bracket.close");
      expect(types).toContain("line.content");
    });

    it("should include block and seq info in content events", () => {
      const parser = createParser();
      const events: LineEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.processChunk('{ "a": 1 } { "b": 2 }');

      const contentEvents = events.filter((e) => e.type === "line.content") as LineContent[];
      // First block has blockId 0, second block has blockId 1
      const block0 = contentEvents.filter((e) => e.block === 0);
      const block1 = contentEvents.filter((e) => e.block === 1);
      expect(block0.length).toBeGreaterThan(0);
      expect(block1.length).toBeGreaterThan(0);
    });
  });
});
