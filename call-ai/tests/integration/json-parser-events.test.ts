import { describe, it, expect, vi } from "vitest";
import { SSEDataParser } from "@vibes.diy/call-ai-base";
import { JsonParser } from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { jsonEvent, JsonEvent, isJsonEventError } from "@vibes.diy/call-ai-base";

function createJsonParser() {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  return new JsonParser(sseParser);
}

describe("JsonParser arktype events", () => {
  it("should emit json.payload events via onEvent", () => {
    const parser = createJsonParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk('data: {"foo":"bar"}\n\n');

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "json.payload",
      lineNr: expect.any(Number),
      json: { foo: "bar" },
    });

    // Validate with arktype
    const result = jsonEvent(events.mock.calls[0][0]);
    expect(isJsonEventError(result)).toBe(false);
  });

  it("should emit json.done event on [DONE]", () => {
    const parser = createJsonParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk('data: {"x":1}\n\ndata: [DONE]\n\n');

    const doneEvents = events.mock.calls.filter((c) => c[0].type === "json.done");
    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0][0]).toEqual({ type: "json.done" });
  });

  it("should validate all events with arktype", () => {
    const parser = createJsonParser();
    const events: JsonEvent[] = [];

    parser.onEvent((evt) => {
      const result = jsonEvent(evt);
      if (isJsonEventError(result)) {
        throw new Error(`Invalid event: ${JSON.stringify(result)}`);
      }
      events.push(evt);
    });

    parser.processChunk('data: {"a":1}\n\ndata: {"b":2}\n\ndata: [DONE]\n\n');

    expect(events.length).toBe(3); // 2 payloads + 1 done
  });

  it("should emit multiple payload events for multiple JSON chunks", () => {
    const parser = createJsonParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c":3}\n\n');

    const payloads = events.mock.calls.filter((c) => c[0].type === "json.payload");
    expect(payloads.length).toBe(3);
    expect(payloads[0][0].json).toEqual({ a: 1 });
    expect(payloads[1][0].json).toEqual({ b: 2 });
    expect(payloads[2][0].json).toEqual({ c: 3 });
  });

  it("should handle chunked input correctly", () => {
    const parser = createJsonParser();
    const events = vi.fn();
    parser.onEvent(events);

    // Split across multiple chunks
    parser.processChunk('data: {"fo');
    parser.processChunk('o":"bar"}\n\n');

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "json.payload",
      json: { foo: "bar" },
    });
  });
});
