import { type } from "arktype";
import { CoercedDate } from "./types.js";
import type { LineStreamOutput } from "./line-stream.js";
import { isLineBegin, isLineLine, isLineEnd, isLineStats } from "./line-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { isSseLine } from "./sse-stream.js";
import { passthrough } from "./passthrough.js";

// Block stream lifecycle events
export const BlockBeginMsg = type({
  type: "'block.begin'",
  id: "string",
  streamId: "string",
  timestamp: CoercedDate,
});

export const BlockEndMsg = type({
  type: "'block.end'",
  id: "string",
  streamId: "string",
  totalToplevelSections: "number",
  totalCodeBlocks: "number",
  totalLines: "number",
  timestamp: CoercedDate,
});

// Toplevel (non-code) section events
export const ToplevelBeginMsg = type({
  type: "'block.toplevel.begin'",
  id: "string",
  streamId: "string",
  index: "number",
  timestamp: CoercedDate,
});

export const ToplevelLineMsg = type({
  type: "'block.toplevel.line'",
  id: "string",
  streamId: "string",
  index: "number",
  lineIndex: "number",
  content: "string",
  timestamp: CoercedDate,
});

export const ToplevelEndMsg = type({
  type: "'block.toplevel.end'",
  id: "string",
  streamId: "string",
  index: "number",
  totalLines: "number",
  timestamp: CoercedDate,
});

// Code block events
export const CodeBeginMsg = type({
  type: "'block.code.begin'",
  id: "string",
  streamId: "string",
  index: "number",
  lang: "string",
  timestamp: CoercedDate,
});

export const CodeLineMsg = type({
  type: "'block.code.line'",
  id: "string",
  streamId: "string",
  index: "number",
  lang: "string",
  lineIndex: "number",
  content: "string",
  timestamp: CoercedDate,
});

export const CodeEndMsg = type({
  type: "'block.code.end'",
  id: "string",
  streamId: "string",
  index: "number",
  lang: "string",
  totalLines: "number",
  timestamp: CoercedDate,
});

// Image block events (raw URL, decoding happens in image-decode-stream)
export const BlockImageMsg = type({
  type: "'block.image'",
  id: "string",
  streamId: "string",
  seq: "number",
  "index?": "number",
  url: "string",
  timestamp: CoercedDate,
});

// Stats message
export const BlockStatsMsg = type({
  type: "'block.stats'",
  streamId: "string",
  stats: {
    toplevelIndex: "number",
    codeIndex: "number",
    imageIndex: "number",
    totalLines: "number",
  },
  timestamp: CoercedDate,
});

// Union types
export const BlockStreamMsg = BlockBeginMsg.or(BlockEndMsg).or(BlockStatsMsg);
export const ToplevelMsg = ToplevelBeginMsg.or(ToplevelLineMsg).or(ToplevelEndMsg);
export const CodeMsg = CodeBeginMsg.or(CodeLineMsg).or(CodeEndMsg);
export const BlockOutput = BlockStreamMsg.or(ToplevelMsg).or(CodeMsg).or(BlockImageMsg);

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
export type BlockOutputMsg = typeof BlockOutput.infer;

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
export const isBlockOutput = (msg: unknown, streamId?: string): msg is BlockOutputMsg =>
  !(BlockOutput(msg) instanceof type.errors) && (!streamId || (msg as BlockOutputMsg).streamId === streamId);

// Regex to match code fence start: ```lang or just ```
const CODE_FENCE_START = /^```(\w*)$/;
// Regex to match code fence end: just ```
const CODE_FENCE_END = /^```$/;

type Mode = "toplevel" | "code";

// Combined output type (passthrough + own events)
export type BlockStreamOutput<T> = T | BlockOutputMsg;

export function createBlockStream<T>(
  filterStreamId: string,
  createId: () => string
): TransformStream<T | LineStreamOutput, BlockStreamOutput<T>> {
  let streamId = "";
  let blockId = "";
  let currentSectionId = "";
  let mode: Mode = "toplevel";
  let sectionStarted = false;
  let currentLang = "";
  let toplevelIndex = 0;
  let codeIndex = 0;
  let imageIndex = 0;
  let lineIndex = 0;
  let totalLines = 0;

  return new TransformStream<T | LineStreamOutput, BlockStreamOutput<T>>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "block.stats",
          streamId: filterStreamId,
          stats: { toplevelIndex, codeIndex, imageIndex, totalLines },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough line.stats
      if (isLineStats(msg, filterStreamId)) {
        return;
      }

      // Check for images in sse.line (no streamId filter - SSE uses main streamId)
      if (isSseLine(msg)) {
        const images = msg.chunk.choices[0]?.delta?.images;
        if (images) {
          for (const img of images) {
            imageIndex++;
            controller.enqueue({
              type: "block.image",
              id: createId(),
              streamId: filterStreamId,
              seq: imageIndex,
              ...(img.index !== undefined && { index: img.index }),
              url: img.image_url.url,
              timestamp: new Date(),
            });
          }
        }
        return;
      }

      if (isLineBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        blockId = createId();
        controller.enqueue({
          type: "block.begin",
          id: blockId,
          streamId,
          timestamp: new Date(),
        });
      } else if (isLineLine(msg, filterStreamId)) {
        const content = msg.content;
        totalLines++;

        // Check for code fence
        const fenceStartMatch = CODE_FENCE_START.exec(content);

        if (mode === "toplevel") {
          if (fenceStartMatch) {
            // Entering code block
            if (sectionStarted) {
              controller.enqueue({
                type: "block.toplevel.end",
                id: currentSectionId,
                streamId,
                index: toplevelIndex,
                totalLines: lineIndex,
                timestamp: new Date(),
              });
            }
            mode = "code";
            currentLang = fenceStartMatch[1] || "";
            codeIndex++;
            lineIndex = 0;
            sectionStarted = true;
            currentSectionId = createId();
            controller.enqueue({
              type: "block.code.begin",
              id: currentSectionId,
              streamId,
              index: codeIndex,
              lang: currentLang,
              timestamp: new Date(),
            });
          } else {
            // Regular toplevel line
            if (!sectionStarted) {
              toplevelIndex++;
              sectionStarted = true;
              currentSectionId = createId();
              controller.enqueue({
                type: "block.toplevel.begin",
                id: currentSectionId,
                streamId,
                index: toplevelIndex,
                timestamp: new Date(),
              });
            }
            lineIndex++;
            controller.enqueue({
              type: "block.toplevel.line",
              id: currentSectionId,
              streamId,
              index: toplevelIndex,
              lineIndex,
              content,
              timestamp: new Date(),
            });
          }
        } else {
          // mode === "code"
          if (CODE_FENCE_END.test(content)) {
            // Exiting code block
            controller.enqueue({
              type: "block.code.end",
              id: currentSectionId,
              streamId,
              index: codeIndex,
              lang: currentLang,
              totalLines: lineIndex,
              timestamp: new Date(),
            });
            mode = "toplevel";
            sectionStarted = false;
            lineIndex = 0;
          } else {
            // Code line
            lineIndex++;
            controller.enqueue({
              type: "block.code.line",
              id: currentSectionId,
              streamId,
              index: codeIndex,
              lang: currentLang,
              lineIndex,
              content,
              timestamp: new Date(),
            });
          }
        }
      } else if (isLineEnd(msg, filterStreamId)) {
        // Close any open section
        if (sectionStarted) {
          if (mode === "toplevel") {
            controller.enqueue({
              type: "block.toplevel.end",
              id: currentSectionId,
              streamId,
              index: toplevelIndex,
              totalLines: lineIndex,
              timestamp: new Date(),
            });
          } else {
            // Unclosed code block - emit end anyway
            controller.enqueue({
              type: "block.code.end",
              id: currentSectionId,
              streamId,
              index: codeIndex,
              lang: currentLang,
              totalLines: lineIndex,
              timestamp: new Date(),
            });
          }
        }

        controller.enqueue({
          type: "block.end",
          id: blockId,
          streamId,
          totalToplevelSections: toplevelIndex,
          totalCodeBlocks: codeIndex,
          totalLines,
          timestamp: new Date(),
        });
      }
    }),
  });
}

