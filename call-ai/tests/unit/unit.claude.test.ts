/**
 * Claude-specific parser tests
 *
 * Tests OpenRouterParser handling of Claude's content_block_delta format.
 * These test the parser layer - JSON accumulation from text deltas
 * is handled at a higher level (streaming.ts or application code).
 */
import { describe, it, expect } from "vitest";
import { ParserEvent } from "../../pkg/parser/index.js";
import { OpenRouterParser } from "../helpers/parser-test-utils.js";
import { feedFixtureToParser, toSSE } from "../test-helpers.js";

describe("Claude format parser tests", () => {
  describe("content_block_delta handling", () => {
    it("should emit or.delta for text_delta events", () => {
      const parser = new OpenRouterParser();
      const deltas: string[] = [];

      parser.onEvent((evt: ParserEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({
          id: "123",
          type: "content_block_delta",
          delta: { type: "text_delta", text: '{"capital"' },
        }) +
        toSSE({
          id: "123",
          type: "content_block_delta",
          delta: { type: "text_delta", text: ':"Paris", "popul' },
        }) +
        toSSE({
          id: "123",
          type: "content_block_delta",
          delta: { type: "text_delta", text: 'ation":67.5}' },
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      // Parser emits raw text deltas - accumulation happens at higher level
      expect(deltas).toEqual(['{"capital"', ':"Paris", "popul', 'ation":67.5}']);

      // Verify accumulation would produce valid JSON
      const accumulated = deltas.join("");
      expect(() => JSON.parse(accumulated)).not.toThrow();
      expect(JSON.parse(accumulated)).toEqual({
        capital: "Paris",
        population: 67.5,
      });
    });

    it("should handle fragmented chunks splitting mid-SSE", () => {
      const parser = new OpenRouterParser();
      const deltas: string[] = [];

      parser.onEvent((evt: ParserEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        }) +
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: " world" },
        }) +
        "data: [DONE]\n\n";

      // Small chunks to test buffering
      feedFixtureToParser(parser, fixture, 5);

      expect(deltas).toEqual(["Hello", " world"]);
    });

    it("should emit or.json for content_block_stop events", () => {
      const parser = new OpenRouterParser();
      const jsonPayloads: unknown[] = [];

      parser.onEvent((evt: ParserEvent) => {
        if (evt.type === "or.json") jsonPayloads.push(evt.json);
      });

      const fixture =
        toSSE({
          id: "123",
          type: "content_block_delta",
          delta: { type: "text_delta", text: "test" },
        }) +
        toSSE({
          id: "123",
          type: "content_block_stop",
          stop_reason: "end_turn",
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      // All JSON payloads pass through as or.json
      expect(jsonPayloads).toHaveLength(2);
      expect(jsonPayloads[1]).toEqual({
        id: "123",
        type: "content_block_stop",
        stop_reason: "end_turn",
      });
    });
  });

  describe("Claude property splitting scenarios", () => {
    it("should handle property names split across chunks", () => {
      const parser = new OpenRouterParser();
      const deltas: string[] = [];

      parser.onEvent((evt: ParserEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      // Simulate Claude splitting "population" across chunks
      const fixture =
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: '{"capital":"Paris","popul' },
        }) +
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: 'ation":67.5,"lang' },
        }) +
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: 'uages":["French"]}' },
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      const accumulated = deltas.join("");
      const parsed = JSON.parse(accumulated);

      expect(parsed.capital).toBe("Paris");
      expect(parsed.population).toBe(67.5);
      expect(parsed.languages).toEqual(["French"]);
    });

    it("should handle property values split across chunks", () => {
      const parser = new OpenRouterParser();
      const deltas: string[] = [];

      parser.onEvent((evt: ParserEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      // Simulate Claude splitting "Paris" across chunks
      const fixture =
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: '{"capital":"Par' },
        }) +
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: 'is","population":67.5}' },
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      const accumulated = deltas.join("");
      const parsed = JSON.parse(accumulated);

      expect(parsed.capital).toBe("Paris");
      expect(parsed.population).toBe(67.5);
    });
  });
});
