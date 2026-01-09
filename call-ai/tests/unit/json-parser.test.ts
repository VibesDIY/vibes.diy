import { readFileSync } from "node:fs";

import {
  LineStreamParser,
  LineStreamState,
  SSEDataParser,
  JsonParser,
  JsonEvent,
} from "call-ai";
import { describe, it, expect, vi } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const openAiStreamFixture = readFileSync(
  new URL("./fixtures/openai-stream-response.json", import.meta.url),
  "utf8",
);

// Helper to create a parser stack (SSE-based)
function createSSEJsonParser() {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  return jsonParser;
}

describe("JsonParser", () => {
  it("parses single JSON object", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"foo":"bar"}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ foo: "bar" });
  });

  it("parses multiple JSON objects", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"a":1}\n\ndata: {"b":2}\n');

    expect(events).toHaveLength(2);
    expect(events[0].json).toEqual({ a: 1 });
    expect(events[1].json).toEqual({ b: 2 });
  });

  it("handles chunked JSON", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"fo');
    parser.processChunk('o":"bar"}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ foo: "bar" });
  });

  it("handles data: prefix split across chunks", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk("dat");
    parser.processChunk('a: {"x":1}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ x: 1 });
  });

  it("emits onDone when [DONE] received", () => {
    const parser = createSSEJsonParser();
    const doneSpy = vi.fn();
    parser.onDone(doneSpy);

    parser.processChunk("data: [DONE]\n");

    expect(doneSpy).toHaveBeenCalledTimes(1);
  });

  it("skips invalid JSON", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk("data: not-json\n");
    parser.processChunk('data: {"valid":true}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ valid: true });
  });

  it("handles nested JSON", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"nested":{"deep":"value"}}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ nested: { deep: "value" } });
  });

  it("handles JSON with arrays", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"items":[1,2,3]}\n');

    expect(events).toHaveLength(1);
    expect(events[0].json).toEqual({ items: [1, 2, 3] });
  });

  it("preserves lineNr from SSEDataEvent", () => {
    const parser = createSSEJsonParser();
    const events: JsonEvent[] = [];
    parser.onJson((evt) => events.push(evt));

    parser.processChunk('data: {"first":1}\n\ndata: {"second":2}\n');

    expect(events[0].lineNr).toBe(0);
    expect(events[1].lineNr).toBe(2); // Empty line between is line 1
  });

  describe("with fixtures (random chunking)", () => {
    it("parses all JSON from openai-stream fixture", () => {
      const parser = createSSEJsonParser();
      const events: JsonEvent[] = [];
      const doneSpy = vi.fn();
      parser.onJson((evt) => events.push(evt));
      parser.onDone(doneSpy);

      feedFixtureRandomly(parser, openAiStreamFixture, { seed: 12345 });

      // 33 data lines minus [DONE] = 32 JSON objects
      expect(events).toHaveLength(32);
      expect(doneSpy).toHaveBeenCalledTimes(1);

      // All are valid parsed JSON with expected structure
      events.forEach((evt) => {
        const json = evt.json as Record<string, unknown>;
        expect(json.id).toBeDefined();
        expect(json.provider).toBe("OpenAI");
        expect(json.choices).toBeDefined();
      });
    });
  });
});
