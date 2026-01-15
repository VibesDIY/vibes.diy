import { describe, it, expect, vi } from "vitest";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { SSEDataParser } from "@vibes.diy/call-ai-base";
import { sseEvent, SseEvent, isSseEventError } from "@vibes.diy/call-ai-base";

function createSSEParser() {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  return new SSEDataParser(lineParser);
}

describe("SSEDataParser arktype events", () => {
  it("should emit sse.data events via onEvent", () => {
    const parser = createSSEParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk('data: {"foo":"bar"}\n');

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "sse.data",
      lineNr: expect.any(Number),
      payload: '{"foo":"bar"}',
    });

    // Validate with arktype
    const result = sseEvent(events.mock.calls[0][0]);
    expect(isSseEventError(result)).toBe(false);
  });

  it("should emit sse.done event on [DONE]", () => {
    const parser = createSSEParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk("data: [DONE]\n");

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "sse.done",
      lineNr: expect.any(Number),
    });
  });

  it("should emit sse.data followed by sse.done for mixed content", () => {
    const parser = createSSEParser();
    const events: SseEvent[] = [];
    parser.onEvent((evt) => events.push(evt));

    parser.processChunk('data: {"x":1}\n\ndata: [DONE]\n');

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("sse.data");
    expect(events[1].type).toBe("sse.done");
  });

  it("should validate all events with arktype", () => {
    const parser = createSSEParser();
    const events: SseEvent[] = [];

    parser.onEvent((evt) => {
      const result = sseEvent(evt);
      if (isSseEventError(result)) {
        throw new Error(`Invalid event: ${JSON.stringify(result)}`);
      }
      events.push(evt);
    });

    parser.processChunk('data: {"a":1}\n\ndata: {"b":2}\n\ndata: [DONE]\n');

    expect(events.length).toBe(3); // 2 data + 1 done
    expect(events[0].type).toBe("sse.data");
    expect(events[1].type).toBe("sse.data");
    expect(events[2].type).toBe("sse.done");
  });

  it("should handle chunked input correctly", () => {
    const parser = createSSEParser();
    const events = vi.fn();
    parser.onEvent(events);

    // Split "data: " across chunks
    parser.processChunk("dat");
    parser.processChunk('a: {"foo":"bar"}\n');

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "sse.data",
      payload: '{"foo":"bar"}',
    });
  });

  it("should ignore non-data lines", () => {
    const parser = createSSEParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk(": comment line\n");
    parser.processChunk("\n"); // empty line
    parser.processChunk('data: {"x":1}\n');

    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0].type).toBe("sse.data");
  });

  it("should include payload in sse.data events", () => {
    const parser = createSSEParser();
    const events: SseEvent[] = [];
    parser.onEvent((evt) => events.push(evt));

    parser.processChunk('data: {"nested":{"value":123}}\n');

    expect(events).toHaveLength(1);
    if (events[0].type === "sse.data") {
      expect(events[0].payload).toBe('{"nested":{"value":123}}');
    } else {
      throw new Error("Expected sse.data event");
    }
  });
});
