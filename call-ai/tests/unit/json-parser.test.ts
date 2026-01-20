import { readFileSync } from "node:fs";

import {} from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { SSEDataParser } from "@vibes.diy/call-ai-base";
import { JsonParser } from "@vibes.diy/call-ai-base";
import { describe, it, expect, vi } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";
import { JsonPayload } from "@vibes.diy/call-ai-base";

const openAiStreamFixture = readFileSync(new URL("./fixtures/openai-stream-response.json", import.meta.url), "utf8");

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
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"foo":"bar"}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ foo: "bar" });
  });

  it("parses multiple JSON objects", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"a":1}\n\ndata: {"b":2}\n');

    expect(payloads).toHaveLength(2);
    expect(payloads[0].json).toEqual({ a: 1 });
    expect(payloads[1].json).toEqual({ b: 2 });
  });

  it("handles chunked JSON", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"fo');
    parser.processChunk('o":"bar"}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ foo: "bar" });
  });

  it("handles data: prefix split across chunks", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk("dat");
    parser.processChunk('a: {"x":1}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ x: 1 });
  });

  it("emits json.done when [DONE] received", () => {
    const parser = createSSEJsonParser();
    const doneEvents = vi.fn();
    parser.onEvent((evt) => {
      if (evt.type === "json.done") doneEvents();
    });

    parser.processChunk("data: [DONE]\n");

    expect(doneEvents).toHaveBeenCalledTimes(1);
  });

  it("skips invalid JSON", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk("data: not-json\n");
    parser.processChunk('data: {"valid":true}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ valid: true });
  });

  it("handles nested JSON", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"nested":{"deep":"value"}}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ nested: { deep: "value" } });
  });

  it("handles JSON with arrays", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"items":[1,2,3]}\n');

    expect(payloads).toHaveLength(1);
    expect(payloads[0].json).toEqual({ items: [1, 2, 3] });
  });

  it("preserves lineNr from SSEDataEvent", () => {
    const parser = createSSEJsonParser();
    const payloads: JsonPayload[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "json.payload") payloads.push(evt);
    });

    parser.processChunk('data: {"first":1}\n\ndata: {"second":2}\n');

    expect(payloads[0].lineNr).toBe(0);
    expect(payloads[1].lineNr).toBe(2); // Empty line between is line 1
  });

  describe("with fixtures (random chunking)", () => {
    it("parses all JSON from openai-stream fixture", () => {
      const parser = createSSEJsonParser();
      const payloads: JsonPayload[] = [];
      const doneEvents = vi.fn();
      parser.onEvent((evt) => {
        switch (evt.type) {
          case "json.payload":
            payloads.push(evt);
            break;
          case "json.done":
            doneEvents();
            break;
        }
      });

      feedFixtureRandomly(parser, openAiStreamFixture, { seed: 12345 });

      // 33 data lines minus [DONE] = 32 JSON objects
      expect(payloads).toHaveLength(32);
      expect(doneEvents).toHaveBeenCalledTimes(1);

      // All are valid parsed JSON with expected structure
      payloads.forEach((evt) => {
        const json = evt.json as Record<string, unknown>;
        expect(json.id).toBeDefined();
        expect(json.provider).toBe("OpenAI");
        expect(json.choices).toBeDefined();
      });
    });
  });
});
