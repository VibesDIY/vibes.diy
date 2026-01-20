import { describe, it, expect, beforeEach } from "vitest";
import {
  createBlockStream,
  isBlockBegin,
  isBlockEnd,
  isBlockStats,
  isToplevelBegin,
  isToplevelLine,
  isToplevelEnd,
  isCodeBegin,
  isCodeLine,
  isCodeEnd,
  BlockBeginMsg,
  BlockEndMsg,
  BlockStatsMsg,
  ToplevelBeginMsg,
  ToplevelLineMsg,
  CodeBeginMsg,
  CodeLineMsg,
  CodeEndMsg,
} from "./block-stream.js";
import { LineStreamOutput, isLineBegin, isLineLine, isLineEnd } from "./line-stream.js";
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

describe("block-stream", () => {
  let idCounter = 0;
  const createId = () => `id-${++idCounter}`;

  beforeEach(() => {
    idCounter = 0;
  });

  describe("createBlockStream", () => {
    const createLineEvents = (streamId: string, lines: string[]): LineStreamOutput[] => {
      const events: LineStreamOutput[] = [{ type: "line.begin", streamId, timestamp: new Date() }];
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

    it("emits block.begin on line.begin", async () => {
      const events = createLineEvents("test", []);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const beginEvent = chunks.find((c) => isBlockBegin(c)) as BlockBeginMsg;
      expect(beginEvent).toBeDefined();
      expect(beginEvent.id).toBe("id-1");
    });

    it("parses toplevel text sections", async () => {
      const events = createLineEvents("test", ["This is some text", "More text here"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      expect(chunks.some((c) => isToplevelBegin(c))).toBe(true);
      const lineEvents = chunks.filter((c) => isToplevelLine(c)) as ToplevelLineMsg[];
      expect(lineEvents).toHaveLength(2);
      expect(lineEvents[0].content).toBe("This is some text");
      expect(lineEvents[1].content).toBe("More text here");
      expect(chunks.some((c) => isToplevelEnd(c))).toBe(true);
    });

    it("parses code blocks", async () => {
      const events = createLineEvents("test", ["```typescript", "const x = 1;", "const y = 2;", "```"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const codeBegin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg;
      expect(codeBegin).toBeDefined();
      expect(codeBegin.lang).toBe("typescript");

      const codeLines = chunks.filter((c) => isCodeLine(c)) as CodeLineMsg[];
      expect(codeLines).toHaveLength(2);
      expect(codeLines[0].content).toBe("const x = 1;");
      expect(codeLines[0].lang).toBe("typescript");
      expect(codeLines[1].content).toBe("const y = 2;");
      expect(codeLines[1].lang).toBe("typescript");

      const codeEnd = chunks.find((c) => isCodeEnd(c)) as CodeEndMsg;
      expect(codeEnd).toBeDefined();
      expect(codeEnd.lang).toBe("typescript");
      expect(codeEnd.totalLines).toBe(2);
    });

    it("handles code blocks without language", async () => {
      const events = createLineEvents("test", ["```", "plain code", "```"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const codeBegin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg;
      expect(codeBegin.lang).toBe("");
    });

    it("handles mixed content", async () => {
      const events = createLineEvents("test", [
        "Here is some text",
        "```javascript",
        "console.log('hello');",
        "```",
        "More text after code",
      ]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const toplevelBegins = chunks.filter((c) => isToplevelBegin(c));
      const codeBegins = chunks.filter((c) => isCodeBegin(c));
      expect(toplevelBegins).toHaveLength(2); // Before and after code
      expect(codeBegins).toHaveLength(1);
    });

    it("emits block.end with correct counts", async () => {
      const events = createLineEvents("test", ["Text 1", "```js", "code", "```", "Text 2", "```python", "more code", "```"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isBlockEnd(c)) as BlockEndMsg;
      expect(endEvent.totalToplevelSections).toBe(2);
      expect(endEvent.totalCodeBlocks).toBe(2);
      expect(endEvent.totalLines).toBe(8);
    });

    it("handles unclosed code block at end", async () => {
      const events = createLineEvents("test", [
        "```typescript",
        "const x = 1;",
        // No closing ```
      ]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      // Should still emit code.end
      const codeEnd = chunks.find((c) => isCodeEnd(c)) as CodeEndMsg;
      expect(codeEnd).toBeDefined();
      expect(codeEnd.totalLines).toBe(1);
    });

    it("passes through upstream events", async () => {
      const events = createLineEvents("test", ["text"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      expect(isLineBegin(chunks[0])).toBe(true);
      expect(isBlockEnd(chunks[chunks.length - 1])).toBe(true);
      expect(chunks.some((c) => isLineLine(c))).toBe(true);
      expect(chunks.some((c) => isLineEnd(c))).toBe(true);
    });

    it("emits block.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: LineStreamOutput[] = [
        { type: "line.begin", streamId: "test", timestamp: new Date() },
        { type: "line.line", streamId: "test", content: "text", lineNr: 1, timestamp: new Date() },
        { type: "line.line", streamId: "test", content: "```js", lineNr: 2, timestamp: new Date() },
        { type: "line.line", streamId: "test", content: "code", lineNr: 3, timestamp: new Date() },
        statsCollect,
        { type: "line.line", streamId: "test", content: "```", lineNr: 4, timestamp: new Date() },
        { type: "line.end", streamId: "test", totalLines: 4, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isBlockStats(c)) as BlockStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.toplevelIndex).toBe(1);
      expect(statsEvents[0].stats.codeIndex).toBe(1);
      expect(statsEvents[0].stats.totalLines).toBe(3);
    });

    it("assigns unique ids to sections", async () => {
      const events = createLineEvents("test", ["text", "```js", "code", "```", "more text"]);
      const input = new ReadableStream<LineStreamOutput>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", createId));
      const chunks = await collectStream(output);

      const blockBegin = chunks.find((c) => isBlockBegin(c)) as BlockBeginMsg;
      const toplevelBegins = chunks.filter((c) => isToplevelBegin(c)) as ToplevelBeginMsg[];
      const codeBegin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg;

      // All should have unique IDs
      const ids = [blockBegin.id, ...toplevelBegins.map((t) => t.id), codeBegin.id];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
