import { describe, it, expect } from "vitest";
import {
  createDeltaStream,
  isDeltaBegin,
  isDeltaLine,
  isDeltaEnd,
  isDeltaStats,
  DeltaBeginMsg,
  DeltaLineMsg,
  DeltaEndMsg,
  DeltaStatsMsg,
  isDeltaUsage,
} from "./delta-stream.js";
import { SseChunk, isSseBegin, isSseLine, isSseEnd, SseStreamMsg } from "./sse-stream.js";
import { StatsCollectMsg } from "./stats-stream.js";
import { ensureSuperThis } from "@fireproof/core-runtime";

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

// Create valid SSE chunk
const createSseChunk = (content: string, finishReason: string | null = null): SseChunk => ({
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

describe("delta-stream", () => {
  const sthis = ensureSuperThis();
  function createId() {
    return sthis.nextId().str;
  }
  describe("createDeltaStream", () => {
    const createSseEvents = (streamId: string, chunks: SseChunk[]): SseStreamMsg[] => {
      const events: SseStreamMsg[] = [{ type: "sse.begin", streamId, timestamp: new Date() }];
      chunks.forEach((chunk, i) => {
        events.push({
          type: "sse.line",
          streamId,
          chunk,
          chunkNr: i + 1,
          timestamp: new Date(),
        });
      });
      events.push({
        type: "sse.end",
        streamId,
        usages: [],
        totalChunks: chunks.length,
        totalErrors: 0,
        timestamp: new Date(),
      });
      return events;
    };

    it("emits delta.begin on first sse.line", async () => {
      const events = createSseEvents("test", [createSseChunk("Hello")]);
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const beginEvent = chunks.find((c) => isDeltaBegin(c)) as DeltaBeginMsg;
      expect(beginEvent).toBeDefined();
      expect(beginEvent.id).toBe("chatcmpl-123");
      expect(beginEvent.model).toBe("gpt-4");
    });

    it("emits delta.line for content deltas", async () => {
      const events = createSseEvents("test", [createSseChunk("Hello"), createSseChunk(" "), createSseChunk("world")]);
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const deltaChunks = chunks.filter((c) => isDeltaBegin(c) || isDeltaLine(c) || isDeltaEnd(c));
      expect(isDeltaBegin(deltaChunks[0])).toBe(true);
      expect(isDeltaEnd(deltaChunks[deltaChunks.length - 1])).toBe(true);

      const deltaLines = chunks.filter((c) => isDeltaLine(c)) as DeltaLineMsg[];
      expect(deltaLines).toHaveLength(3);
      expect(deltaLines[0].content).toBe("Hello");
      expect(deltaLines[1].content).toBe(" ");
      expect(deltaLines[2].content).toBe("world");
      expect(deltaLines[0].deltaSeq).toBe(0);
      expect(deltaLines[2].deltaSeq).toBe(2);
    });

    it("skips chunks without content", async () => {
      const chunkNoContent: SseChunk = {
        id: "chatcmpl-123",
        provider: "openai",
        model: "gpt-4",
        object: "chat.completion.chunk",
        created: Date.now(),
        choices: [
          {
            index: 0,
            delta: { role: "assistant" },
            finish_reason: null,
            native_finish_reason: null,
            logprobs: null,
          },
        ],
      };
      const events = createSseEvents("test", [chunkNoContent, createSseChunk("content")]);
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const deltaLines = chunks.filter((c) => isDeltaLine(c));
      expect(deltaLines).toHaveLength(1);
    });

    it("emits delta.end with correct stats", async () => {
      const events = createSseEvents("test", [createSseChunk("Hello"), createSseChunk(" world"), createSseChunk("!", "stop")]);
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isDeltaEnd(c)) as DeltaEndMsg;
      expect(endEvent.finishReasons).toEqual(["stop"]);
      expect(endEvent.totalDeltas).toBe(3);
      expect(endEvent.totalChars).toBe(12); // "Hello" + " world" + "!"
    });

    it("includes usage when available", async () => {
      const chunkWithUsage = {
        ...createSseChunk("done", "stop"),
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };
      const events: SseStreamMsg[] = [
        { type: "sse.begin", streamId: "test", timestamp: new Date() },
        { type: "sse.line", streamId: "test", chunk: chunkWithUsage, chunkNr: 1, timestamp: new Date() },
        {
          type: "sse.end",
          streamId: "test",
          totalChunks: 1,
          totalErrors: 0,
          usages: [{ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }],
          timestamp: new Date(),
        },
      ];
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isDeltaEnd(c)) as DeltaEndMsg;
      expect(endEvent.usages).toEqual([
        {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      ]);
    });

    it("passes through upstream events", async () => {
      const events = createSseEvents("test", [createSseChunk("x")]);
      const input = new ReadableStream<SseStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      expect(isSseBegin(chunks[0])).toBe(true);
      expect(isDeltaEnd(chunks[chunks.length - 1])).toBe(true);
      expect(chunks.some((c) => isSseLine(c))).toBe(true);
      expect(chunks.some((c) => isSseEnd(c))).toBe(true);
    });

    it("emits delta.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: (SseStreamMsg | StatsCollectMsg)[] = [
        { type: "sse.begin", streamId: "test", timestamp: new Date() },
        { type: "sse.line", streamId: "test", chunk: createSseChunk("Hello"), chunkNr: 1, timestamp: new Date() },
        statsCollect,
        { type: "sse.end", streamId: "test", totalChunks: 1, totalErrors: 0, timestamp: new Date(), usages: [] },
      ];

      const input = new ReadableStream<SseStreamMsg | StatsCollectMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDeltaStream("test", createId));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isDeltaStats(c)) as DeltaStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.deltaSeq).toBe(1);
      expect(statsEvents[0].stats.totalChars).toBe(5);
    });
  });

  it("test if sse usage emits delta.usage", async () => {
    const sseChunkWithUsage = {
      id: "gen-1770372166-US3EkzcxdcK8HI1BKteb",
      provider: "Google",
      model: "anthropic/claude-sonnet-4",
      object: "chat.completion.chunk",
      created: 1770372167,
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "" },
          finish_reason: null,
          native_finish_reason: null,
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 1198,
        completion_tokens: 288,
        total_tokens: 1486,
        cost: 0.007914,
        is_byok: false,
        prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
        cost_details: {
          upstream_inference_cost: 0.007914,
          upstream_inference_prompt_cost: 0.003594,
          upstream_inference_completions_cost: 0.00432,
        },
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    };
    const events: SseStreamMsg[] = [
      { type: "sse.begin", streamId: "test", timestamp: new Date() },
      { type: "sse.line", streamId: "test", chunk: sseChunkWithUsage, chunkNr: 1, timestamp: new Date() },
      {
        type: "sse.end",
        streamId: "test",
        totalChunks: 1,
        totalErrors: 0,
        usages: [sseChunkWithUsage.usage],
        timestamp: new Date(),
      },
    ];
    const input = new ReadableStream<SseStreamMsg>({
      start(controller) {
        events.forEach((e) => controller.enqueue(e));
        controller.close();
      },
    });

    const output = input.pipeThrough(createDeltaStream("test", createId));
    const chunks = await collectStream(output);
    expect(chunks.filter((i) => isDeltaUsage(i))[0].usage).toEqual(sseChunkWithUsage.usage);
    expect(chunks.filter((i) => isDeltaEnd(i))[0].usages).toEqual([sseChunkWithUsage.usage]);
  });
});
