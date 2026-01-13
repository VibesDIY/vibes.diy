import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { createBaseParser } from "../../pkg/parser/create-base-parser.js";
import { orEvent, OrEvent, isOrEventError } from "../../pkg/parser/openrouter-events.js";

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(__dirname, "fixtures", filename), "utf8");
}

describe("OpenRouterParser arktype events", () => {
  it("should emit typed or.* events via onEvent", () => {
    const parser = createBaseParser();
    const events = vi.fn();
    parser.onEvent(events);

    parser.processChunk(loadFixture("openai-fireproof-stream-response.txt"));

    // All events should match arktype schema
    for (const [evt] of events.mock.calls) {
      const result = orEvent(evt);
      expect(isOrEventError(result)).toBe(false);
    }

    // First event is or.json (raw chunk)
    expect(events.mock.calls[0][0].type).toBe("or.json");

    // or.meta follows once identified in the chunk
    const metaEvent = events.mock.calls.find(c => c[0].type === "or.meta")?.[0];
    expect(metaEvent).toMatchObject({
      type: "or.meta",
      model: "openai/gpt-4o",
      provider: "OpenAI",
    });

    // Many or.delta events
    const deltas = events.mock.calls.filter((c) => c[0].type === "or.delta");
    expect(deltas.length).toBeGreaterThan(100);
    expect(deltas[0][0]).toMatchObject({
      type: "or.delta",
      seq: 0,
      content: expect.any(String),
    });

    // or.done event
    const doneEvents = events.mock.calls.filter((c) => c[0].type === "or.done");
    expect(doneEvents[0][0]).toMatchObject({
      type: "or.done",
      finishReason: "stop",
    });

    // or.usage event
    const usageEvents = events.mock.calls.filter((c) => c[0].type === "or.usage");
    expect(usageEvents[0][0]).toMatchObject({
      type: "or.usage",
      promptTokens: 89,
      completionTokens: 228,
      totalTokens: 317,
    });

    // or.stream-end event
    const streamEndEvents = events.mock.calls.filter((c) => c[0].type === "or.stream-end");
    expect(streamEndEvents.length).toBe(1);
  });

  it("should validate events with arktype at runtime", () => {
    const parser = createBaseParser();
    const events: OrEvent[] = [];
    parser.onEvent((evt) => {
      // Validate each event as it arrives
      const result = orEvent(evt);
      if (isOrEventError(result)) {
        throw new Error(`Invalid event: ${JSON.stringify(result)}`);
      }
      events.push(evt);
    });

    // Should not throw
    parser.processChunk(loadFixture("openai-fireproof-stream-response.txt"));
    expect(events.length).toBeGreaterThan(100);
  });
});
