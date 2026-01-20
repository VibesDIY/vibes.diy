import { describe, it, expect } from "vitest";
import {
  createSseStream,
  isSseBegin,
  isSseLine,
  isSseError,
  isSseEnd,
  isSseStats,
  SseLineMsg,
  SseErrorMsg,
  SseEndMsg,
  SseStatsMsg,
  SseChunk,
} from "./sse-stream.js";
import { DataOutput, isDataBegin, isDataLine, isDataEnd } from "./data-stream.js";
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

// Valid SSE chunk structure
const createValidChunk = (content: string, finishReason: string | null = null): SseChunk => ({
  id: "chatcmpl-123",
  provider: "openai",
  model: "gpt-4",
  object: "chat.completion.chunk",
  created: Date.now(),
  choices: [
    {
      index: 0,
      delta: { content },
      finish_reason: finishReason,
      native_finish_reason: finishReason,
      logprobs: null,
    },
  ],
});

describe("sse-stream", () => {
  describe("createSseStream", () => {
    const createDataEvents = (streamId: string, jsonObjects: unknown[]): DataOutput[] => {
      const events: DataOutput[] = [{ type: "data.begin", streamId, timestamp: new Date() }];
      jsonObjects.forEach((json, i) => {
        events.push({
          type: "data.line",
          streamId,
          json,
          dataLineNr: i + 1,
          timestamp: new Date(),
        });
      });
      events.push({
        type: "data.end",
        streamId,
        totalDataLines: jsonObjects.length,
        timestamp: new Date(),
      });
      return events;
    };

    it("emits sse.begin on data.begin", async () => {
      const events = createDataEvents("test", []);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      expect(chunks.some((c) => isSseBegin(c))).toBe(true);
    });

    it("validates and emits sse.line for valid chunks", async () => {
      const events = createDataEvents("test", [createValidChunk("Hello"), createValidChunk(" world")]);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      const sseLines = chunks.filter((c) => isSseLine(c)) as SseLineMsg[];
      expect(sseLines).toHaveLength(2);
      expect(sseLines[0].chunk.choices[0].delta.content).toBe("Hello");
      expect(sseLines[1].chunk.choices[0].delta.content).toBe(" world");
      expect(sseLines[0].chunkNr).toBe(1);
      expect(sseLines[1].chunkNr).toBe(2);
    });

    it("emits sse.error for invalid chunks", async () => {
      const events = createDataEvents("test", [{ invalid: "structure" }, createValidChunk("valid")]);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      const errors = chunks.filter((c) => isSseError(c)) as SseErrorMsg[];
      const validLines = chunks.filter((c) => isSseLine(c));
      expect(errors).toHaveLength(1);
      expect(errors[0].errorNr).toBe(1);
      expect(validLines).toHaveLength(1);
    });

    it("emits sse.end with correct counts", async () => {
      const events = createDataEvents("test", [createValidChunk("a"), { invalid: true }, createValidChunk("b")]);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isSseEnd(c)) as SseEndMsg;
      expect(endEvent.totalChunks).toBe(2);
      expect(endEvent.totalErrors).toBe(1);
    });

    it("captures usage from chunks", async () => {
      const chunkWithUsage = {
        ...createValidChunk("done"),
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };
      const events = createDataEvents("test", [chunkWithUsage]);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isSseEnd(c)) as SseEndMsg;
      expect(endEvent.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      });
    });

    it("passes through upstream events", async () => {
      const events = createDataEvents("test", [createValidChunk("x")]);
      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      expect(isDataBegin(chunks[0])).toBe(true);
      expect(isSseEnd(chunks[chunks.length - 1])).toBe(true);
      expect(chunks.some((c) => isDataLine(c))).toBe(true);
      expect(chunks.some((c) => isDataEnd(c))).toBe(true);
    });

    it("emits sse.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: DataOutput[] = [
        { type: "data.begin", streamId: "test", timestamp: new Date() },
        { type: "data.line", streamId: "test", json: createValidChunk("x"), dataLineNr: 1, timestamp: new Date() },
        statsCollect,
        { type: "data.end", streamId: "test", totalDataLines: 1, timestamp: new Date() },
      ];

      const input = new ReadableStream<DataOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createSseStream("test"));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isSseStats(c)) as SseStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.chunkNr).toBe(1);
      expect(statsEvents[0].stats.errorNr).toBe(0);
    });
  });
});
