import { describe, it, expect } from "vitest";
import {
  createDataStream,
  isDataBegin,
  isDataLine,
  isDataEnd,
  isDataStats,
  type DataLineMsg,
  type DataEndMsg,
  type DataStatsMsg,
} from "./data-stream.js";
import { isLineBegin, isLineLine, isLineEnd, LineStreamMsg } from "./line-stream.js";
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

describe("data-stream", () => {
  describe("createDataStream", () => {
    const createLineEvents = (streamId: string, lines: string[]): LineStreamMsg[] => {
      const events: LineStreamMsg[] = [{ type: "line.begin", streamId, timestamp: new Date() }];
      lines.forEach((content, i) => {
        events.push({
          type: "line.line",
          streamId,
          content,
          lineNr: i + 1,
          timestamp: new Date(),
        });
      });
      events.push({
        type: "line.end",
        streamId,
        totalLines: lines.length,
        timestamp: new Date(),
      });
      return events;
    };

    it("emits data.begin on line.begin", async () => {
      const events = createLineEvents("test", []);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      expect(chunks.some((c) => isDataBegin(c))).toBe(true);
    });

    it("parses SSE data lines", async () => {
      const events = createLineEvents("test", ['data: {"id":"123","content":"hello"}', 'data: {"id":"456","content":"world"}']);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const dataLines = chunks.filter((c) => isDataLine(c)) as DataLineMsg[];
      expect(dataLines).toHaveLength(2);
      expect(dataLines[0].json).toEqual({ id: "123", content: "hello" });
      expect(dataLines[1].json).toEqual({ id: "456", content: "world" });
      expect(dataLines[0].dataLineNr).toBe(1);
      expect(dataLines[1].dataLineNr).toBe(2);
    });

    it("ignores non-data lines", async () => {
      const events = createLineEvents("test", [": comment", "event: message", 'data: {"valid":"json"}', ""]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const dataLines = chunks.filter((c) => isDataLine(c)) as DataLineMsg[];
      expect(dataLines).toHaveLength(1);
    });

    it("ignores [DONE] marker", async () => {
      const events = createLineEvents("test", ['data: {"id":"1"}', "data: [DONE]"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const dataLines = chunks.filter((c) => isDataLine(c));
      expect(dataLines).toHaveLength(1);
    });

    it("skips malformed JSON", async () => {
      const events = createLineEvents("test", ["data: not-json", 'data: {"valid":"json"}']);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const dataLines = chunks.filter((c) => isDataLine(c));
      expect(dataLines).toHaveLength(1);
    });

    it("emits data.end with correct count", async () => {
      const events = createLineEvents("test", ['data: {"a":1}', 'data: {"b":2}', 'data: {"c":3}']);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isDataEnd(c)) as DataEndMsg;
      expect(endEvent.totalDataLines).toBe(3);
    });

    it("passes through upstream events", async () => {
      const events = createLineEvents("test", ['data: {"x":1}']);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      expect(isLineBegin(chunks[0])).toBe(true);
      expect(isDataEnd(chunks[chunks.length - 1])).toBe(true);
      expect(chunks.some((c) => isLineLine(c))).toBe(true);
      expect(chunks.some((c) => isLineEnd(c))).toBe(true);
    });

    it("emits data.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: (StatsCollectMsg | LineStreamMsg)[] = [
        { type: "line.begin", streamId: "test", timestamp: new Date() },
        { type: "line.line", streamId: "test", content: 'data: {"x":1}', lineNr: 1, timestamp: new Date() },
        statsCollect,
        { type: "line.end", streamId: "test", totalLines: 1, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg | StatsCollectMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isDataStats(c)) as DataStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.dataLineNr).toBe(1);
    });

    it("filters by streamId", async () => {
      const events: LineStreamMsg[] = [
        { type: "line.begin", streamId: "other", timestamp: new Date() },
        { type: "line.line", streamId: "other", content: 'data: {"x":1}', lineNr: 1, timestamp: new Date() },
        { type: "line.end", streamId: "other", totalLines: 1, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createDataStream("test"));
      const chunks = await collectStream(output);

      // Should not emit data.begin for different streamId
      expect(chunks.some((c) => isDataBegin(c))).toBe(false);
    });
  });
});
