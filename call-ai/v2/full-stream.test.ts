import { describe, it, expect } from "vitest";
import { createFullStream, isFullBegin, isFullEnd, isFullStats, FullBeginMsg, FullEndMsg, FullStatsMsg } from "./full-stream.js";
import { DeltaOutput, isDeltaBegin, isDeltaLine, isDeltaEnd } from "./delta-stream.js";
import { StatsCollectMsg } from "./stats-stream.js";

// Helper to collect all chunks from a stream
async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const chunks: T[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe("full-stream", () => {
  describe("createFullStream", () => {
    const createDeltaEvents = (
      streamId: string,
      deltas: { index: number; content: string }[],
      finishReason: string | null = "stop",
    ): DeltaOutput[] => {
      const events: DeltaOutput[] = [
        {
          type: "delta.begin",
          streamId,
          id: "chatcmpl-123",
          model: "gpt-4",
          timestamp: new Date(),
        },
      ];
      deltas.forEach((delta, i) => {
        events.push({
          type: "delta.line",
          streamId,
          index: delta.index,
          content: delta.content,
          deltaNr: i + 1,
          timestamp: new Date(),
        });
      });
      events.push({
        type: "delta.end",
        streamId,
        finishReason,
        totalDeltas: deltas.length,
        totalChars: deltas.reduce((sum, d) => sum + d.content.length, 0),
        timestamp: new Date(),
      });
      return events;
    };

    it("emits full.begin on delta.begin", async () => {
      const events = createDeltaEvents("test", []);
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      const beginEvent = chunks.find((c) => isFullBegin(c)) as FullBeginMsg;
      expect(beginEvent).toBeDefined();
      expect(beginEvent.id).toBe("chatcmpl-123");
      expect(beginEvent.model).toBe("gpt-4");
    });

    it("accumulates content and emits full.end", async () => {
      const events = createDeltaEvents("test", [
        { index: 0, content: "Hello" },
        { index: 0, content: " " },
        { index: 0, content: "world" },
      ]);
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isFullEnd(c)) as FullEndMsg;
      expect(endEvent).toBeDefined();
      expect(endEvent.content).toBe("Hello world");
      expect(endEvent.index).toBe(0);
      expect(endEvent.finishReason).toBe("stop");
    });

    it("handles multiple indices separately", async () => {
      const events = createDeltaEvents("test", [
        { index: 0, content: "First" },
        { index: 1, content: "Second" },
        { index: 0, content: " choice" },
        { index: 1, content: " option" },
      ]);
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      const endEvents = chunks.filter((c) => isFullEnd(c)) as FullEndMsg[];
      expect(endEvents).toHaveLength(2);

      const index0 = endEvents.find((e) => e.index === 0);
      const index1 = endEvents.find((e) => e.index === 1);
      expect(index0?.content).toBe("First choice");
      expect(index1?.content).toBe("Second option");
    });

    it("includes usage when available", async () => {
      const events: DeltaOutput[] = [
        { type: "delta.begin", streamId: "test", id: "123", model: "gpt-4", timestamp: new Date() },
        { type: "delta.line", streamId: "test", index: 0, content: "Hi", deltaNr: 1, timestamp: new Date() },
        {
          type: "delta.end",
          streamId: "test",
          finishReason: "stop",
          totalDeltas: 1,
          totalChars: 2,
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          timestamp: new Date(),
        },
      ];
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isFullEnd(c)) as FullEndMsg;
      expect(endEvent.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });

    it("passes through upstream events", async () => {
      const events = createDeltaEvents("test", [{ index: 0, content: "x" }]);
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      expect(isDeltaBegin(chunks[0])).toBe(true);
      expect(isFullEnd(chunks[chunks.length - 1])).toBe(true);
      expect(chunks.some((c) => isDeltaLine(c))).toBe(true);
      expect(chunks.some((c) => isDeltaEnd(c))).toBe(true);
    });

    it("emits full.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: DeltaOutput[] = [
        { type: "delta.begin", streamId: "test", id: "123", model: "gpt-4", timestamp: new Date() },
        { type: "delta.line", streamId: "test", index: 0, content: "Hello", deltaNr: 1, timestamp: new Date() },
        statsCollect,
        { type: "delta.end", streamId: "test", finishReason: "stop", totalDeltas: 1, totalChars: 5, timestamp: new Date() },
      ];

      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isFullStats(c)) as FullStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.totalChars).toBe(5);
      expect(statsEvents[0].stats.indices).toBe(1);
    });

    it("handles empty content stream", async () => {
      const events = createDeltaEvents("test", [], null);
      const input = new ReadableStream<DeltaOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createFullStream("test"));
      const chunks = await collectStream(output);

      // No full.end should be emitted for empty content
      const endEvents = chunks.filter((c) => isFullEnd(c));
      expect(endEvents).toHaveLength(0);
    });
  });
});
