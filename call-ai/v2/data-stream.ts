import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { LineStreamOutput } from "./line-stream.js";
import { isLineBegin, isLineLine, isLineEnd, isLineStats } from "./line-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { passthrough } from "./passthrough.js";

export const DataBeginMsg = type({
  type: "'data.begin'",
  streamId: "string",
  timestamp: CoercedDate,
});

export const DataLineMsg = type({
  type: "'data.line'",
  streamId: "string",
  json: "unknown",
  dataLineNr: "number",
  timestamp: CoercedDate,
});

export const DataEndMsg = type({
  type: "'data.end'",
  streamId: "string",
  totalDataLines: "number",
  timestamp: CoercedDate,
});

export const DataStatsMsg = type({
  type: "'data.stats'",
  streamId: "string",
  stats: {
    dataLineNr: "number",
  },
  timestamp: CoercedDate,
});

export const DataStreamMsg = DataBeginMsg.or(DataLineMsg).or(DataEndMsg).or(DataStatsMsg);

export type DataBeginMsg = typeof DataBeginMsg.infer;
export type DataLineMsg = typeof DataLineMsg.infer;
export type DataEndMsg = typeof DataEndMsg.infer;
export type DataStatsMsg = typeof DataStatsMsg.infer;
export type DataStreamMsg = typeof DataStreamMsg.infer;

// Type guards with optional streamId filter
export const isDataBegin = (msg: unknown, streamId?: string): msg is DataBeginMsg =>
  !(DataBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as DataBeginMsg).streamId === streamId);
export const isDataLine = (msg: unknown, streamId?: string): msg is DataLineMsg =>
  !(DataLineMsg(msg) instanceof type.errors) && (!streamId || (msg as DataLineMsg).streamId === streamId);
export const isDataEnd = (msg: unknown, streamId?: string): msg is DataEndMsg =>
  !(DataEndMsg(msg) instanceof type.errors) && (!streamId || (msg as DataEndMsg).streamId === streamId);
export const isDataStats = (msg: unknown, streamId?: string): msg is DataStatsMsg =>
  !(DataStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as DataStatsMsg).streamId === streamId);
export const isDataMsg = (msg: unknown, streamId?: string): msg is DataStreamMsg =>
  !(DataStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as DataStreamMsg).streamId === streamId);

// Combined output type (passthrough + own events)
export type DataOutput = LineStreamOutput | DataStreamMsg;

export function createDataStream(filterStreamId: string): TransformStream<LineStreamOutput, DataOutput> {
  let dataLineNr = 0;
  let streamId = "";

  return new TransformStream<LineStreamOutput, DataOutput>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "data.stats",
          streamId: filterStreamId,
          stats: { dataLineNr },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough line.stats
      if (isLineStats(msg, filterStreamId)) {
        return;
      }

      if (isLineBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        controller.enqueue({
          type: "data.begin",
          streamId,
          timestamp: new Date(),
        });
      } else if (isLineLine(msg, filterStreamId)) {
        if (msg.content.startsWith("data: ")) {
          const jsonStr = msg.content.slice(6);
          if (jsonStr === "[DONE]") return;

          try {
            const json = JSON.parse(jsonStr);
            dataLineNr++;
            controller.enqueue({
              type: "data.line",
              streamId,
              json,
              dataLineNr,
              timestamp: new Date(),
            });
          } catch {
            // Skip malformed JSON
          }
        }
      } else if (isLineEnd(msg, filterStreamId)) {
        controller.enqueue({
          type: "data.end",
          streamId,
          totalDataLines: dataLineNr,
          timestamp: new Date(),
        });
      }
    }),
  });
}
