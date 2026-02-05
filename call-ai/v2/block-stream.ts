import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isLineBegin, isLineLine, isLineEnd, LineStreamMsg, createLineStream, LineStreamInput } from "./line-stream.js";
import { isStatsCollect, StatsCollectMsg } from "./stats-stream.js";
import { passthrough } from "./passthrough.js";
import { DeltaStreamMsg, isDeltaBegin, isDeltaEnd, isDeltaImage, isDeltaLine, isDeltaUsage } from "./delta-stream.js";
import { consumeStream, Lazy } from "@adviser/cement";
import { SseUsage } from "./sse-stream.js";

export const BlockBase = type({
  blockId: "string",
  streamId: "string",
  seq: "number",
  blockNr: "number",
  timestamp: CoercedDate,
});

export const BlockStats = type({
  lines: "number",
  bytes: "number",
  "cnt?": "number",
});
export type BlockStats = typeof BlockStats.infer;

const BlockStatsBox = type({
  stats: BlockStats,
});
// Block stream lifecycle events
export const BlockBeginMsg = type({
  type: "'block.begin'",
}).and(BlockBase);

export const BlockEndMsg = type({
  type: "'block.end'",
  stats: {
    toplevel: BlockStats,
    code: BlockStats,
    image: BlockStats,
    total: BlockStats,
  },
  usage: {
    "given?": SseUsage.or("undefined"),
    calculated: SseUsage,
  },
}).and(BlockBase);

// Toplevel (non-code) section events
export const ToplevelBeginMsg = type({
  type: "'block.toplevel.begin'",
  sectionId: "string",
}).and(BlockBase);

const BlockLine = type({
  lineNr: "number",
  line: "string",
});

export const ToplevelLineMsg = type({
  type: "'block.toplevel.line'",
  sectionId: "string",
})
  .and(BlockBase)
  .and(BlockLine);

export const ToplevelEndMsg = type({
  type: "'block.toplevel.end'",
  sectionId: "string",
})
  .and(BlockBase)
  .and(BlockStatsBox);
// Code block events
export const CodeBeginMsg = type({
  type: "'block.code.begin'",
  sectionId: "string",
  lang: "string",
}).and(BlockBase);
export const CodeLineMsg = type({
  type: "'block.code.line'",
  sectionId: "string",
  lang: "string",
})
  .and(BlockBase)
  .and(BlockLine);

export const CodeEndMsg = type({
  type: "'block.code.end'",
  sectionId: "string",
  lang: "string",
})
  .and(BlockBase)
  .and(BlockStatsBox);

// Image block events (raw URL, decoding happens in image-decode-stream)
export const BlockImageMsg = type({
  type: "'block.image'",
  sectionId: "string",
  url: "string",
})
  .and(BlockBase)
  .and(BlockStatsBox);

// Stats message
export const BlockStatsMsg = type({
  type: "'block.stats'",
  stats: {
    toplevel: BlockStats,
    code: BlockStats,
    image: BlockStats,
    total: BlockStats,
  },
  usage: SseUsage,
}).and(BlockBase);

// Union types
export const ToplevelMsg = ToplevelBeginMsg.or(ToplevelLineMsg).or(ToplevelEndMsg);
export const CodeMsg = CodeBeginMsg.or(CodeLineMsg).or(CodeEndMsg);
export const LineMsg = ToplevelLineMsg.or(CodeLineMsg);
export const BeginMsg = ToplevelBeginMsg.or(CodeBeginMsg);
export const BlockStreamMsg = BlockBeginMsg.or(BlockEndMsg).or(BlockStatsMsg).or(BlockImageMsg).or(CodeMsg).or(ToplevelMsg);
// export const BlockOutput = BlockStreamMsg.or(ToplevelMsg).or(CodeMsg).or(BlockImageMsg);

export const BlockMsgs = BlockStreamMsg.or(ToplevelMsg).or(CodeMsg);

// Inferred types
export type BlockBeginMsg = typeof BlockBeginMsg.infer;
export type BlockEndMsg = typeof BlockEndMsg.infer;
export type BlockStatsMsg = typeof BlockStatsMsg.infer;
export type ToplevelBeginMsg = typeof ToplevelBeginMsg.infer;
export type ToplevelLineMsg = typeof ToplevelLineMsg.infer;
export type ToplevelEndMsg = typeof ToplevelEndMsg.infer;
export type CodeBeginMsg = typeof CodeBeginMsg.infer;
export type CodeLineMsg = typeof CodeLineMsg.infer;
export type CodeEndMsg = typeof CodeEndMsg.infer;
export type BlockImageMsg = typeof BlockImageMsg.infer;
export type BlockStreamMsg = typeof BlockStreamMsg.infer;
export type ToplevelMsg = typeof ToplevelMsg.infer;
export type CodeMsg = typeof CodeMsg.infer;
export type BlockMsgs = typeof BlockMsgs.infer;
export type LineMsg = typeof LineMsg.infer;
export type BeginMsg = typeof BeginMsg.infer;

// Type guards with optional streamId filter
export const isBlockBegin = (msg: unknown, streamId?: string): msg is BlockBeginMsg =>
  !(BlockBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as BlockBeginMsg).streamId === streamId);
export const isBlockEnd = (msg: unknown, streamId?: string): msg is BlockEndMsg =>
  !(BlockEndMsg(msg) instanceof type.errors) && (!streamId || (msg as BlockEndMsg).streamId === streamId);
export const isBlockStats = (msg: unknown, streamId?: string): msg is BlockStatsMsg =>
  !(BlockStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as BlockStatsMsg).streamId === streamId);
export const isToplevelBegin = (msg: unknown, streamId?: string): msg is ToplevelBeginMsg =>
  !(ToplevelBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as ToplevelBeginMsg).streamId === streamId);
export const isToplevelLine = (msg: unknown, streamId?: string): msg is ToplevelLineMsg =>
  !(ToplevelLineMsg(msg) instanceof type.errors) && (!streamId || (msg as ToplevelLineMsg).streamId === streamId);
export const isToplevelEnd = (msg: unknown, streamId?: string): msg is ToplevelEndMsg =>
  !(ToplevelEndMsg(msg) instanceof type.errors) && (!streamId || (msg as ToplevelEndMsg).streamId === streamId);
export const isCodeBegin = (msg: unknown, streamId?: string): msg is CodeBeginMsg =>
  !(CodeBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as CodeBeginMsg).streamId === streamId);
export const isCodeLine = (msg: unknown, streamId?: string): msg is CodeLineMsg =>
  !(CodeLineMsg(msg) instanceof type.errors) && (!streamId || (msg as CodeLineMsg).streamId === streamId);
export const isCodeEnd = (msg: unknown, streamId?: string): msg is CodeEndMsg =>
  !(CodeEndMsg(msg) instanceof type.errors) && (!streamId || (msg as CodeEndMsg).streamId === streamId);
export const isBlockImage = (msg: unknown, streamId?: string): msg is BlockImageMsg =>
  !(BlockImageMsg(msg) instanceof type.errors) && (!streamId || (msg as BlockImageMsg).streamId === streamId);
export const isBlockSteamMsg = (msg: unknown, streamId?: string): msg is BlockStreamMsg =>
  !(BlockStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as BlockStreamMsg).streamId === streamId);

// Regex to match code fence start: ```lang or just ```
const CODE_FENCE_START = /^```(\w*)$/;
// Regex to match code fence end: just ```
const CODE_FENCE_END = /^```$/;

type Mode = "toplevel" | "code";

function addStat(target: BlockStats, source: BlockStats) {
  target.lines += source.lines;
  target.bytes += source.bytes;
}

function addSSeUsage(target: SseUsage, source: SseUsage) {
  target.prompt_tokens += source.prompt_tokens;
  target.completion_tokens += source.completion_tokens;
  target.total_tokens += source.total_tokens;
}

export function createBlockStream(
  streamId: string,
  innerStreamId: string,
  createId: () => string
): TransformStream<LineStreamMsg | DeltaStreamMsg | StatsCollectMsg, BlockStreamMsg> {
  let blockId = "";
  let mode: Mode = "toplevel";
  let sectionStarted = false;
  let currentLang = "";
  let currentSectionId = "";
  const toplevelStat = { lines: 0, bytes: 0, cnt: 0 };
  const codeStat = { lines: 0, bytes: 0, cnt: 0 };
  const imageStat = { lines: 0, bytes: 0, cnt: 0 };
  const totalStat = { lines: 0, bytes: 0, cnt: 0 };
  let blockStat = { lines: 0, bytes: 0, cnt: 0 };
  let seq = 0;
  let blockNr = 0;

  function beginBlockAction(controller: TransformStreamDefaultController<BlockStreamMsg>) {
    blockId = createId();
    blockStat = { lines: 0, bytes: 0, cnt: 0 };
    blockNr = 0;
    controller.enqueue({
      type: "block.begin",
      blockId,
      blockNr: blockNr,
      streamId,
      seq: seq++,
      timestamp: new Date(),
    });
  }

  let beginBlock = Lazy(beginBlockAction);

  let currentUsageSSE: SseUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let givenUsageSSE: SseUsage | undefined = undefined;
  const usageSumByUsage: SseUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  return new TransformStream<LineStreamMsg | DeltaStreamMsg, BlockStreamMsg>({
    transform(msg, controller) {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, streamId) || isDeltaUsage(msg, streamId)) {
        if (isDeltaUsage(msg, streamId)) {
          currentUsageSSE = msg.usage;
          addSSeUsage(usageSumByUsage, msg.usage);
        }
        controller.enqueue({
          type: "block.stats",
          blockId,
          seq,
          streamId,
          blockNr,
          stats: {
            toplevel: toplevelStat,
            code: codeStat,
            image: imageStat,
            total: totalStat,
          },
          usage: currentUsageSSE,
          timestamp: new Date(),
        });
        return;
      }
      if (isDeltaEnd(msg, streamId)) {
        const accu = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        for (const usage of msg.usages) {
          addSSeUsage(accu, usage);
        }
        givenUsageSSE = accu;
      }

      if (isDeltaImage(msg, streamId)) {
        // No-op, block begun on line.begin
        beginBlock(controller);
        imageStat.cnt++;
        imageStat.bytes += msg.image.image_url.url.length;
        totalStat.cnt++;
        totalStat.bytes += msg.image.image_url.url.length;
        controller.enqueue({
          type: "block.image",
          blockId,
          sectionId: createId(),
          blockNr: blockNr++,
          streamId,
          seq: seq++,
          timestamp: new Date(),
          stats: imageStat,
          url: msg.image.image_url.url,
        });
        return;
      }
      if (isLineBegin(msg, innerStreamId)) {
        beginBlock(controller);
        return;
      }
      if (isLineLine(msg, innerStreamId)) {
        const content = msg.content;

        // Check for code fence
        const fenceStartMatch = CODE_FENCE_START.exec(content);

        if (mode === "toplevel") {
          if (fenceStartMatch) {
            // Entering code block
            if (sectionStarted) {
              addStat(totalStat, blockStat);
              addStat(toplevelStat, blockStat);
              totalStat.cnt++;
              toplevelStat.cnt++;
              controller.enqueue({
                type: "block.toplevel.end",
                streamId,
                sectionId: currentSectionId,
                stats: toplevelStat,
                timestamp: new Date(),
                blockId,
                seq: seq++,
                blockNr: blockNr++,
              });
            }
            mode = "code";
            currentLang = fenceStartMatch[1] || "";

            sectionStarted = true;
            currentSectionId = createId();
            blockStat = { lines: 0, bytes: 0, cnt: 0 };
            totalStat.lines++;
            controller.enqueue({
              type: "block.code.begin",
              lang: currentLang,
              timestamp: new Date(),
              sectionId: currentSectionId,
              blockId,
              streamId,
              seq: seq++,
              blockNr: blockNr,
            });
          } else {
            // Regular toplevel line
            if (!sectionStarted) {
              sectionStarted = true;
              currentSectionId = createId();
              blockStat = { lines: 0, bytes: 0, cnt: 0 };
              controller.enqueue({
                type: "block.toplevel.begin",
                streamId,
                sectionId: currentSectionId,
                timestamp: new Date(),
                blockId,
                seq: seq++,
                blockNr: blockNr,
              });
            }
            blockStat.bytes += content.length;
            controller.enqueue({
              type: "block.toplevel.line",
              timestamp: new Date(),
              lineNr: blockStat.lines++,
              sectionId: currentSectionId,
              line: content,
              blockId,
              seq: seq++,
              streamId,
              blockNr: blockNr,
            });
          }
        } else {
          // mode === "code"
          if (CODE_FENCE_END.test(content)) {
            // Exiting code block
            addStat(totalStat, blockStat);
            addStat(codeStat, blockStat);
            codeStat.cnt++;
            totalStat.cnt++;
            totalStat.lines++;
            controller.enqueue({
              type: "block.code.end",
              timestamp: new Date(),
              blockId,
              streamId,
              sectionId: currentSectionId,
              seq: seq++,
              blockNr: blockNr++,
              lang: currentLang,
              stats: blockStat,
            });
            mode = "toplevel";
            sectionStarted = false;
          } else {
            // Code line
            blockStat.bytes += content.length;
            controller.enqueue({
              type: "block.code.line",
              lang: currentLang,
              timestamp: new Date(),
              sectionId: currentSectionId,
              lineNr: blockStat.lines++,
              line: content,
              blockId,
              seq: seq++,
              streamId,
              blockNr: blockNr,
            });
          }
        }
      } else if (isLineEnd(msg, innerStreamId)) {
        // Close any open section
        if (sectionStarted) {
          if (mode === "toplevel") {
            toplevelStat.cnt++;
            totalStat.cnt++;
            totalStat.lines++;
            addStat(totalStat, blockStat);
            addStat(toplevelStat, blockStat);
            controller.enqueue({
              type: "block.toplevel.end",
              blockId,
              streamId,
              stats: blockStat,
              sectionId: currentSectionId,
              seq: seq++,
              blockNr: blockNr++,
              timestamp: new Date(),
            });
          } else {
            // Unclosed code block - emit end anyway
            totalStat.cnt++;
            codeStat.cnt++;
            totalStat.lines++;
            addStat(totalStat, blockStat);
            addStat(codeStat, blockStat);
            toplevelStat.cnt++;
            controller.enqueue({
              type: "block.code.end",
              blockId,
              streamId,
              lang: currentLang,
              sectionId: currentSectionId,
              seq: seq++,
              blockNr: blockNr++,
              stats: blockStat,
              timestamp: new Date(),
            });
          }
        }
        beginBlock = Lazy(beginBlockAction);
        controller.enqueue({
          type: "block.end",
          timestamp: new Date(),
          blockId,
          streamId,
          seq: seq++,
          blockNr: blockNr++,
          stats: {
            toplevel: toplevelStat,
            code: codeStat,
            image: imageStat,
            total: totalStat,
          },
          usage: {
            given: givenUsageSSE,
            calculated: usageSumByUsage,
          },
        });
      }
    },
  });
}

// Output type for createLineStreamFromDelta (passthrough + block events)

export function createSectionsStream(
  filterStreamId: string,
  createId: () => string
): TransformStream<DeltaStreamMsg, BlockStreamMsg> {
  let transStream: TransformStream;
  let writer: WritableStreamDefaultWriter<LineStreamInput | DeltaStreamMsg | StatsCollectMsg>;
  let consumePromise: Promise<unknown>;
  let blockStreamId: string;
  const txtEndcoder = new TextEncoder();
  return new TransformStream<DeltaStreamMsg, BlockStreamMsg>({
    transform: passthrough(async (msg, controller) => {
      switch (true) {
        case isDeltaBegin(msg, filterStreamId): {
          blockStreamId = createId();
          transStream = new TransformStream();
          writer = transStream.writable.getWriter();
          consumePromise = consumeStream(
            transStream.readable
              .pipeThrough(createLineStream(blockStreamId))
              .pipeThrough(createBlockStream(filterStreamId, blockStreamId, createId)), // blockstream is not passthrough
            (e) => controller.enqueue(e)
          );
          break;
        }

        case isDeltaLine(msg, filterStreamId):
          writer?.write(txtEndcoder.encode(msg.content));
          break;

        case isDeltaImage(msg, filterStreamId):
          writer?.write({ ...msg, streamId: blockStreamId });
          break;

        case isDeltaUsage(msg, filterStreamId):
          writer?.write({ ...msg, streamId: blockStreamId });
          break;

        case isDeltaEnd(msg, filterStreamId):
          writer?.write({ ...msg, streamId: blockStreamId });
          if (writer) {
            await writer.close().then(() => consumePromise);
          } else {
            await consumePromise;
          }
          break;

        default:
          writer?.write(msg);
          break;
      }
    }),
  });
}
