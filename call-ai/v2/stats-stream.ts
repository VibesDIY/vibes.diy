import { type } from "arktype";
import { CoercedDate } from "./types.js";

// Stats collect trigger message - injected at root to trigger stats emission
export const StatsCollectMsg = type({
  type: "'stats.collect'",
  streamId: "string",
  timestamp: CoercedDate,
});

export type StatsCollectMsg = typeof StatsCollectMsg.infer;

export const isStatsCollect = (msg: unknown, streamId?: string): msg is StatsCollectMsg =>
  !(StatsCollectMsg(msg) instanceof type.errors) && (!streamId || (msg as StatsCollectMsg).streamId === streamId);

/**
 * Creates a transform stream that injects stats.collect messages at regular intervals
 */
export function createStatsCollector<T>(streamId: string, intervalMs = 1000): TransformStream<T, T | StatsCollectMsg> {
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let controller: TransformStreamDefaultController<T | StatsCollectMsg> | undefined;

  return new TransformStream<T, T | StatsCollectMsg>({
    start(ctrl) {
      controller = ctrl;
      intervalId = setInterval(() => {
        controller?.enqueue({
          type: "stats.collect",
          streamId,
          timestamp: new Date(),
        });
      }, intervalMs);
    },
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
    },
    flush() {
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Emit final stats collect on stream end
      controller?.enqueue({
        type: "stats.collect",
        streamId,
        timestamp: new Date(),
      });
    },
  });
}
