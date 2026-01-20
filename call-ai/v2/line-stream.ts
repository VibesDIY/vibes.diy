import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isStatsCollect, type StatsCollectMsg } from "./stats-stream.js";
import type { SseLineMsg } from "./sse-stream.js";

export const LineBeginMsg = type({
  type: "'line.begin'",
  streamId: "string",
  timestamp: CoercedDate,
});

export const LineLineMsg = type({
  type: "'line.line'",
  streamId: "string",
  content: "string",
  lineNr: "number",
  timestamp: CoercedDate,
});

export const LineEndMsg = type({
  type: "'line.end'",
  streamId: "string",
  totalLines: "number",
  timestamp: CoercedDate,
});

export const LineStatsMsg = type({
  type: "'line.stats'",
  streamId: "string",
  stats: {
    totalBytes: "number",
    lineNr: "number",
  },
  timestamp: CoercedDate,
});

export const LineStreamMsg = LineBeginMsg.or(LineLineMsg).or(LineEndMsg).or(LineStatsMsg);

export type LineBeginMsg = typeof LineBeginMsg.infer;
export type LineLineMsg = typeof LineLineMsg.infer;
export type LineEndMsg = typeof LineEndMsg.infer;
export type LineStatsMsg = typeof LineStatsMsg.infer;
export type LineStreamMsg = typeof LineStreamMsg.infer;

// Type guards with optional streamId filter
export const isLineBegin = (msg: unknown, streamId?: string): msg is LineBeginMsg =>
  !(LineBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as LineBeginMsg).streamId === streamId);
export const isLineLine = (msg: unknown, streamId?: string): msg is LineLineMsg =>
  !(LineLineMsg(msg) instanceof type.errors) && (!streamId || (msg as LineLineMsg).streamId === streamId);
export const isLineEnd = (msg: unknown, streamId?: string): msg is LineEndMsg =>
  !(LineEndMsg(msg) instanceof type.errors) && (!streamId || (msg as LineEndMsg).streamId === streamId);
export const isLineStats = (msg: unknown, streamId?: string): msg is LineStatsMsg =>
  !(LineStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as LineStatsMsg).streamId === streamId);
export const isLineMsg = (msg: unknown, streamId?: string): msg is LineStreamMsg =>
  !(LineStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as LineStreamMsg).streamId === streamId);

// Line parser state - can be used standalone or within transforms
export interface LineParser {
  streamId: string;
  buffer: string;
  totalBytes: number;
  lineNr: number;
  started: boolean;
}

export function createLineParser(streamId: string): LineParser {
  return { streamId, buffer: "", totalBytes: 0, lineNr: 0, started: false };
}

export function parseContent(parser: LineParser, content: string): LineStreamMsg[] {
  const events: LineStreamMsg[] = [];

  if (!parser.started) {
    parser.started = true;
    events.push({
      type: "line.begin",
      streamId: parser.streamId,
      timestamp: new Date(),
    });
  }

  parser.totalBytes += new TextEncoder().encode(content).length;
  parser.buffer += content;

  const lines = parser.buffer.split("\n");
  parser.buffer = lines.pop() ?? "";

  for (const line of lines) {
    parser.lineNr++;
    events.push({
      type: "line.line",
      streamId: parser.streamId,
      content: line,
      lineNr: parser.lineNr,
      timestamp: new Date(),
    });
  }

  return events;
}

export function flushParser(parser: LineParser): LineStreamMsg[] {
  const events: LineStreamMsg[] = [];

  if (parser.buffer.length > 0) {
    parser.lineNr++;
    events.push({
      type: "line.line",
      streamId: parser.streamId,
      content: parser.buffer,
      lineNr: parser.lineNr,
      timestamp: new Date(),
    });
  }

  events.push({
    type: "line.end",
    streamId: parser.streamId,
    totalLines: parser.lineNr,
    timestamp: new Date(),
  });

  return events;
}

// Combined output type for line stream (input can include stats.collect trigger or sse.line for passthrough)
export type LineStreamInput = Uint8Array | StatsCollectMsg | SseLineMsg;
export type LineStreamOutput = LineStreamMsg | StatsCollectMsg | SseLineMsg;

export function createLineStream(filterStreamId: string): TransformStream<LineStreamInput, LineStreamOutput> {
  let buffer = "";
  let totalBytes = 0;
  let lineNr = 0;
  let started = false;
  const decoder = new TextDecoder();

  return new TransformStream<LineStreamInput, LineStreamOutput>({
    transform(chunk, controller) {
      // Handle stats.collect trigger
      if (isStatsCollect(chunk, filterStreamId)) {
        controller.enqueue(chunk); // passthrough
        controller.enqueue({
          type: "line.stats",
          streamId: filterStreamId,
          stats: { totalBytes, lineNr },
          timestamp: new Date(),
        });
        return;
      }

      // Handle Uint8Array input - pass through anything else
      if (!(chunk instanceof Uint8Array)) {
        controller.enqueue(chunk as LineStreamOutput);
        return;
      }

      if (!started) {
        started = true;
        controller.enqueue({
          type: "line.begin",
          streamId: filterStreamId,
          timestamp: new Date(),
        });
      }

      totalBytes += chunk.byteLength;
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        lineNr++;
        controller.enqueue({
          type: "line.line",
          streamId: filterStreamId,
          content: line,
          lineNr,
          timestamp: new Date(),
        });
      }
    },

    flush(controller) {
      if (buffer.length > 0) {
        lineNr++;
        controller.enqueue({
          type: "line.line",
          streamId: filterStreamId,
          content: buffer,
          lineNr,
          timestamp: new Date(),
        });
      }

      controller.enqueue({
        type: "line.end",
        streamId: filterStreamId,
        totalLines: lineNr,
        timestamp: new Date(),
      });
    },
  });
}
