import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { LineStreamMsg } from "./line-stream.js";
import { isLineBegin, isLineLine, isLineEnd } from "./line-stream.js";
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

export const DataErrorMsg = type({
  type: "'data.error'",
  streamId: "string",
  message: "string",
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

export const DataStreamMsg = DataBeginMsg.or(DataLineMsg).or(DataEndMsg).or(DataStatsMsg).or(DataErrorMsg);

export type DataBeginMsg = typeof DataBeginMsg.infer;
export type DataLineMsg = typeof DataLineMsg.infer;
export type DataEndMsg = typeof DataEndMsg.infer;
export type DataStatsMsg = typeof DataStatsMsg.infer;
export type DataErrorMsg = typeof DataErrorMsg.infer;
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
export const isDataError = (msg: unknown, streamId?: string): msg is DataErrorMsg =>
  !(DataErrorMsg(msg) instanceof type.errors) && (!streamId || (msg as DataErrorMsg).streamId === streamId);

// Combined output type (passthrough + own events)

export function createDataStream(filterStreamId: string): TransformStream<LineStreamMsg, DataStreamMsg> {
  let dataLineNr = 0;
  let streamId = "";

  return new TransformStream<LineStreamMsg, DataStreamMsg>({
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

      if (isLineBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        controller.enqueue({
          type: "data.begin",
          streamId,
          timestamp: new Date(),
        });
      } else if (isLineLine(msg, filterStreamId)) {
        if (msg.content.startsWith("data: ")) {
          try {
            if (msg.content.trim() !== "data: [DONE]") {
              const json = JSON.parse(msg.content.slice("data: ".length));
              dataLineNr++;
              controller.enqueue({
                type: "data.line",
                streamId,
                json,
                dataLineNr,
                timestamp: new Date(),
              });
            }
          } catch (e) {
            controller.enqueue({
              type: "data.error",
              streamId,
              message: `Malformed JSON in data line: ${(e as Error).message}`,
              dataLineNr,
              timestamp: new Date(),
            });
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
