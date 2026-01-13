import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { StreamConverter } from "../../pkg/stream-converter/stream-converter.js";

function fixtureToStream(filename: string): ReadableStream<Uint8Array> {
  const content = fs.readFileSync(path.join(__dirname, "fixtures", filename));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(content);
      controller.close();
    },
  });
}

describe("StreamConverter", () => {
  it("should emit standardized events from SSE stream", async () => {
    const converter = new StreamConverter();
    const events = vi.fn();
    converter.register(events);

    await converter.processPrompt({
      prompt: "test prompt",
      model: "openai/gpt-4o",
      inputStream: fixtureToStream("openai-fireproof-stream-response.txt"),
    });

    // First event is stream-begin with prompt
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "call-ai.stream-begin",
      prompt: "test prompt",
      model: "openai/gpt-4o",
      provider: "OpenAI",
    });

    // Many delta events
    const deltas = events.mock.calls.filter((c) => c[0].type === "call-ai.stream-delta");
    expect(deltas.length).toBeGreaterThan(100);

    // End event
    const endEvents = events.mock.calls.filter((c) => c[0].type === "call-ai.stream-end");
    expect(endEvents[0][0]).toMatchObject({
      type: "call-ai.stream-end",
      finishReason: "stop",
    });

    // Usage event
    const usageEvents = events.mock.calls.filter((c) => c[0].type === "call-ai.stream-usage");
    expect(usageEvents[0][0]).toMatchObject({
      type: "call-ai.stream-usage",
      promptTokens: 89,
      completionTokens: 228,
      totalTokens: 317,
    });
  });

  it("should include streamId in all events", async () => {
    const converter = new StreamConverter();
    const events = vi.fn();
    converter.register(events);

    await converter.processPrompt({
      prompt: "test",
      model: "openai/gpt-4o",
      inputStream: fixtureToStream("openai-fireproof-stream-response.txt"),
    });

    // Get the streamId from first event
    const streamId = events.mock.calls[0][0].streamId;
    expect(streamId).toBeDefined();
    expect(typeof streamId).toBe("string");

    // All events should have the same streamId
    for (const call of events.mock.calls) {
      expect(call[0].streamId).toBe(streamId);
    }
  });

  it("should emit events in order: begin -> deltas -> end/usage", async () => {
    const converter = new StreamConverter();
    const eventTypes: string[] = [];
    converter.register((evt) => eventTypes.push(evt.type));

    await converter.processPrompt({
      prompt: "test",
      model: "openai/gpt-4o",
      inputStream: fixtureToStream("openai-fireproof-stream-response.txt"),
    });

    // First event is begin
    expect(eventTypes[0]).toBe("call-ai.stream-begin");

    // Last events include end and usage
    const lastFew = eventTypes.slice(-3);
    expect(lastFew).toContain("call-ai.stream-end");
    expect(lastFew).toContain("call-ai.stream-usage");

    // Deltas are in between
    const deltaCount = eventTypes.filter((t) => t === "call-ai.stream-delta").length;
    expect(deltaCount).toBeGreaterThan(100);
  });
});
