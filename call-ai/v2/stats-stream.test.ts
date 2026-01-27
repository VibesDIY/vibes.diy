import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStatsCollector, type StatsCollectMsg, isStatsCollect } from "./stats-stream.js";

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

describe("stats-stream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createStatsCollector", () => {
    it("passes through input chunks unchanged", async () => {
      const collector = createStatsCollector<Uint8Array>("test-stream", 10000);
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      });

      const output = input.pipeThrough(collector);
      const chunks = await collectStream(output);

      // Filter out stats.collect messages
      const dataChunks = chunks.filter((c) => c instanceof Uint8Array);
      expect(dataChunks).toHaveLength(2);
      expect(dataChunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(dataChunks[1]).toEqual(new Uint8Array([4, 5, 6]));
    });

    it("emits stats.collect on interval", async () => {
      const collector = createStatsCollector<Uint8Array>("test-stream", 100);
      const input = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array([1]));
          // Wait for interval to fire
          await vi.advanceTimersByTimeAsync(150);
          controller.enqueue(new Uint8Array([2]));
          controller.close();
        },
      });

      const output = input.pipeThrough(collector);
      const chunks = await collectStream(output);

      const statsMessages = chunks.filter((c) => isStatsCollect(c));
      // At least one from interval + one from flush
      expect(statsMessages.length).toBeGreaterThanOrEqual(2);
      expect(statsMessages[0]).toMatchObject({
        type: "stats.collect",
        streamId: "test-stream",
      });
    });

    it("emits final stats.collect on stream end", async () => {
      const collector = createStatsCollector<Uint8Array>("test-stream", 10000);
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      });

      const output = input.pipeThrough(collector);
      const chunks = await collectStream(output);

      const lastChunk = chunks[chunks.length - 1];
      expect(isStatsCollect(lastChunk)).toBe(true);
      expect(lastChunk).toMatchObject({
        type: "stats.collect",
        streamId: "test-stream",
      });
    });

    it("uses correct streamId in emitted messages", async () => {
      const collector = createStatsCollector<Uint8Array>("my-unique-id", 10000);
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });

      const output = input.pipeThrough(collector);
      const chunks = await collectStream(output);

      const statsMsg = chunks.find((c) => isStatsCollect(c)) as StatsCollectMsg;
      expect(statsMsg.streamId).toBe("my-unique-id");
    });
  });
});
