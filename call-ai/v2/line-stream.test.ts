import { describe, it, expect } from "vitest";
import {
  createLineStream,
  createLineParser,
  parseContent,
  flushParser,
  isLineBegin,
  isLineLine,
  isLineEnd,
  isLineStats,
  type LineBeginMsg,
  type LineLineMsg,
  type LineStatsMsg,
} from "./line-stream.js";
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

describe("line-stream", () => {
  describe("LineParser", () => {
    it("creates parser with initial state", () => {
      const parser = createLineParser("test-stream");
      expect(parser.streamId).toBe("test-stream");
      expect(parser.buffer).toBe("");
      expect(parser.totalBytes).toBe(0);
      expect(parser.lineNr).toBe(0);
      expect(parser.started).toBe(false);
    });

    it("emits line.begin on first content", () => {
      const parser = createLineParser("test");
      const events = parseContent(parser, "hello");

      expect(events[0]).toMatchObject({
        type: "line.begin",
        streamId: "test",
      });
      expect(parser.started).toBe(true);
    });

    it("emits line.line for complete lines", () => {
      const parser = createLineParser("test");
      const events = parseContent(parser, "line1\nline2\n");

      const lineEvents = events.filter((e) => e.type === "line.line");
      expect(lineEvents).toHaveLength(2);
      expect(lineEvents[0]).toMatchObject({
        type: "line.line",
        content: "line1",
        lineNr: 1,
      });
      expect(lineEvents[1]).toMatchObject({
        type: "line.line",
        content: "line2",
        lineNr: 2,
      });
    });

    it("buffers incomplete lines", () => {
      const parser = createLineParser("test");
      parseContent(parser, "partial");
      expect(parser.buffer).toBe("partial");

      const events = parseContent(parser, " content\n");
      const lineEvents = events.filter((e) => e.type === "line.line");
      expect(lineEvents[0]).toMatchObject({
        content: "partial content",
      });
    });

    it("flushParser emits remaining buffer and line.end", () => {
      const parser = createLineParser("test");
      parseContent(parser, "line1\nincomplete");

      const events = flushParser(parser);
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: "line.line",
        content: "incomplete",
      });
      expect(events[1]).toMatchObject({
        type: "line.end",
        totalLines: 2,
      });
    });

    it("tracks totalBytes correctly", () => {
      const parser = createLineParser("test");
      parseContent(parser, "hello"); // 5 bytes
      parseContent(parser, " world\n"); // 7 bytes

      expect(parser.totalBytes).toBe(12);
    });
  });

  describe("createLineStream", () => {
    it("transforms Uint8Array to line messages", async () => {
      const encoder = new TextEncoder();
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("line1\nline2\n"));
          controller.close();
        },
      });

      const output = input.pipeThrough(createLineStream("test"));
      const chunks = await collectStream(output);

      expect(chunks.some((c) => isLineBegin(c))).toBe(true);
      expect(chunks.filter((c) => isLineLine(c))).toHaveLength(2);
      expect(chunks.some((c) => isLineEnd(c))).toBe(true);
    });

    it("handles chunked input correctly", async () => {
      const encoder = new TextEncoder();
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("hel"));
          controller.enqueue(encoder.encode("lo\nwor"));
          controller.enqueue(encoder.encode("ld\n"));
          controller.close();
        },
      });

      const output = input.pipeThrough(createLineStream("test"));
      const chunks = await collectStream(output);

      const lineEvents = chunks.filter((c) => isLineLine(c)) as LineLineMsg[];
      expect(lineEvents).toHaveLength(2);
      expect(lineEvents[0].content).toBe("hello");
      expect(lineEvents[1].content).toBe("world");
    });

    it("emits line.stats on stats.collect", async () => {
      const encoder = new TextEncoder();
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };

      const input = new ReadableStream<Uint8Array | StatsCollectMsg>({
        start(controller) {
          controller.enqueue(encoder.encode("line1\n"));
          controller.enqueue(statsCollect);
          controller.close();
        },
      });

      const output = input.pipeThrough(createLineStream("test"));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isLineStats(c)) as LineStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.lineNr).toBe(1);
    });

    it("uses correct streamId", async () => {
      const encoder = new TextEncoder();
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("test\n"));
          controller.close();
        },
      });

      const output = input.pipeThrough(createLineStream("my-stream-id"));
      const chunks = await collectStream(output);

      const beginEvent = chunks.find((c) => isLineBegin(c)) as LineBeginMsg;
      expect(beginEvent.streamId).toBe("my-stream-id");
    });

    it("flushes incomplete line on stream close", async () => {
      const encoder = new TextEncoder();
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("line1\nline2\nline-without-lineend"));
          controller.close();
        },
      });

      const output = input.pipeThrough(createLineStream("test"));
      const chunks = await collectStream(output);

      expect(isLineBegin(chunks[0])).toBe(true);
      expect(isLineEnd(chunks[chunks.length - 1])).toBe(true);

      const lineEvents = chunks.filter((c) => isLineLine(c)) as LineLineMsg[];
      expect(lineEvents).toHaveLength(3);
      expect(lineEvents[0].content).toBe("line1");
      expect(lineEvents[1].content).toBe("line2");
      expect(lineEvents[2].content).toBe("line-without-lineend");
    });
  });
});
