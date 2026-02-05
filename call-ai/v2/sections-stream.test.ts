import { describe, it, expect, beforeEach } from "vitest";
import {
  createBlockStream,
  isBlockBegin,
  isBlockEnd,
  isBlockStats,
  isBlockImage,
  isToplevelBegin,
  isToplevelLine,
  isToplevelEnd,
  isCodeBegin,
  isCodeLine,
  isCodeEnd,
  BlockBeginMsg,
  BlockEndMsg,
  BlockStatsMsg,
  BlockImageMsg,
  ToplevelBeginMsg,
  ToplevelLineMsg,
  CodeBeginMsg,
  CodeLineMsg,
  CodeEndMsg,
} from "./block-stream.js";
import { LineStreamMsg } from "./line-stream.js";
import { DeltaImageMsg } from "./delta-stream.js";
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

    it("emits block.begin on line.begin", async () => {
      const events = createLineEvents("innerStream", []);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const beginEvent = chunks.find((c) => isBlockBegin(c)) as BlockBeginMsg;
      expect(beginEvent).toBeDefined();
      expect(beginEvent.streamId).toBe("test");
      expect(beginEvent.blockId).toBe("id-1");
    });

    it("parses toplevel text sections", async () => {
      const events = createLineEvents("innerStream", ["This is some text", "More text here"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      expect(chunks.some((c) => isToplevelBegin(c))).toBe(true);
      const lineEvents = chunks.filter((c) => isToplevelLine(c)) as ToplevelLineMsg[];
      expect(lineEvents).toHaveLength(2);
      expect(lineEvents[0].line).toBe("This is some text");
      expect(lineEvents[1].line).toBe("More text here");
      expect(chunks.some((c) => isToplevelEnd(c))).toBe(true);
    });

    it("parses code blocks", async () => {
      const events = createLineEvents("innerStream", ["```typescript", "const x = 1;", "const y = 2;", "```"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const codeBegin = chunks[1] as CodeBeginMsg;
      expect(codeBegin).toBeDefined();
      expect(codeBegin.lang).toBe("typescript");

      const codeLines = chunks.filter((c) => isCodeLine(c)) as CodeLineMsg[];
      expect(codeLines).toHaveLength(2);
      expect(codeLines[0].line).toBe("const x = 1;");
      expect(codeLines[0].lang).toBe("typescript");
      expect(codeLines[1].line).toBe("const y = 2;");
      expect(codeLines[1].lang).toBe("typescript");

      const codeEnd = chunks[chunks.length - 1] as BlockEndMsg;
      expect(codeEnd).toBeDefined();
      expect(codeEnd.stats.code.lines).toBe(2);
    });

    it("handles code blocks without language", async () => {
      const events = createLineEvents("innerStream", ["```", "plain code", "```"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const codeBegin = chunks.find((c) => isCodeBegin(c)) as CodeBeginMsg;
      expect(codeBegin.lang).toBe("");
    });

    it("handles mixed content", async () => {
      const events = createLineEvents("innerStream", [
        "Here is some text",
        "```javascript",
        "console.log('hello');",
        "```",
        "More text after code",
      ]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const toplevelBegins = chunks.filter((c) => isToplevelBegin(c));
      const codeBegins = chunks.filter((c) => isCodeBegin(c));
      expect(toplevelBegins).toHaveLength(2); // Before and after code
      expect(codeBegins).toHaveLength(1);
    });

    it("emits block.end with correct counts", async () => {
      const events = createLineEvents("innerStream", ["Text 1", "```js", "code", "```", "Text 2", "```python", "more code", "```"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const endEvent = chunks[chunks.length - 1] as BlockEndMsg;
      expect(endEvent.stats.toplevel.cnt).toBe(2);
      expect(endEvent.stats.code.cnt).toBe(2);
      expect(endEvent.stats.total.lines).toBe(8);
    });

    it("handles unclosed code block at end", async () => {
      const events = createLineEvents("innerStream", [
        "```typescript",
        "const x = 1;",
        // No closing ```
      ]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      // Should still emit code.end
      const codeEnd = chunks.find((c) => isCodeEnd(c)) as CodeEndMsg;
      expect(codeEnd).toBeDefined();
      expect(codeEnd.stats.lines).toBe(1);
    });

    it("blocks upstream events", async () => {
      const events = createLineEvents("innerStream", ["text"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      expect(isBlockBegin(chunks[0])).toBe(true);
      expect(isToplevelBegin(chunks[1])).toBe(true);
      expect(isToplevelLine(chunks[2])).toBe(true);
      expect(isToplevelEnd(chunks[3])).toBe(true);
      expect(isBlockEnd(chunks[4])).toBe(true);
    });

    it("emits block.stats on stats.collect", async () => {
      const statsCollect: StatsCollectMsg = {
        type: "stats.collect",
        streamId: "test",
        timestamp: new Date(),
      };
      const events: (LineStreamMsg | StatsCollectMsg)[] = [
        { type: "line.begin", streamId: "innerStream", timestamp: new Date() },
        { type: "line.line", streamId: "innerStream", content: "text", lineNr: 1, timestamp: new Date() },
        { type: "line.line", streamId: "innerStream", content: "```js", lineNr: 2, timestamp: new Date() },
        { type: "line.line", streamId: "innerStream", content: "code", lineNr: 3, timestamp: new Date() },
        { type: "line.line", streamId: "innerStream", content: "```", lineNr: 4, timestamp: new Date() },
        statsCollect,
        { type: "line.end", streamId: "innerStream", totalLines: 4, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg | StatsCollectMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const statsEvents = chunks.filter((c) => isBlockStats(c)) as BlockStatsMsg[];
      expect(statsEvents).toHaveLength(1);
      expect(statsEvents[0].stats.toplevel.cnt).toBe(1);
      expect(statsEvents[0].stats.code.cnt).toBe(1);
      expect(statsEvents[0].stats.total.lines).toBe(4);
    });

    it("assigns unique ids to sections", async () => {
      const events = createLineEvents("innerStream", ["text", "```js", "code", "```", "more text"]);
      const input = new ReadableStream<LineStreamMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const blockBegin = chunks.find((c) => isBlockBegin(c)) as BlockBeginMsg;
      const toplevelBegins = chunks.filter((c) => isToplevelBegin(c)) as ToplevelBeginMsg[];
      const codeBegin = chunks.filter((c) => isCodeBegin(c)) as CodeBeginMsg[];

      // All should have unique IDs
      const blockIds = [blockBegin.blockId, ...toplevelBegins.map((t) => t.blockId), ...codeBegin.map((c) => c.blockId)];
      expect(new Set(blockIds).size).toBe(1);
      const sectionIds = [...toplevelBegins.map((t) => t.sectionId), ...codeBegin.map((c) => c.sectionId)];
      expect(new Set(sectionIds).size).toBe(3);
    });

    it("emits block.image on delta.image", async () => {
      const imageUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const deltaImage: DeltaImageMsg = {
        type: "delta.image",
        streamId: "test",
        imageId: "img-1",
        imageSeq: 0,
        image: {
          type: "image",
          index: 0,
          image_url: { url: imageUrl },
        },
        choiceSeq: 0,
        deltaSeq: 1,
        index: 0,
        timestamp: new Date(),
      };

      const input = new ReadableStream<DeltaImageMsg>({
        start(controller) {
          controller.enqueue(deltaImage);
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      // Should emit block.begin (lazily triggered by image)
      expect(chunks[0].type).toBe("block.begin");

      // Should emit block.image
      const imageEvent = chunks[1] as BlockImageMsg;
      expect(imageEvent).toBeDefined();
      expect(imageEvent.type).toBe("block.image");
      expect(imageEvent.url).toBe(imageUrl);
      expect(imageEvent.streamId).toBe("test");
      expect(imageEvent.sectionId).toBeDefined();
      expect(imageEvent.stats.bytes).toBe(imageUrl.length);
    });

    it("tracks image stats in block.end", async () => {
      const imageUrl = "data:image/png;base64,abc123";
      const events: (LineStreamMsg | DeltaImageMsg)[] = [
        { type: "line.begin", streamId: "innerStream", timestamp: new Date() },
        {
          type: "delta.image",
          streamId: "test",
          imageId: "img-1",
          imageSeq: 0,
          image: { type: "image", index: 0, image_url: { url: imageUrl } },
          choiceSeq: 0,
          deltaSeq: 1,
          index: 0,
          timestamp: new Date(),
        },
        { type: "line.end", streamId: "innerStream", totalLines: 0, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg | DeltaImageMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const endEvent = chunks.find((c) => isBlockEnd(c)) as BlockEndMsg;
      expect(endEvent).toBeDefined();
      expect(endEvent.stats.image.cnt).toBe(1);
      expect(endEvent.stats.image.bytes).toBe(imageUrl.length);
      expect(endEvent.stats.total.cnt).toBe(1);
      expect(endEvent.stats.total.bytes).toBe(imageUrl.length);
    });

    it("handles multiple images", async () => {
      const imageUrl1 = "data:image/png;base64,first";
      const imageUrl2 = "data:image/png;base64,second";
      const events: (LineStreamMsg | DeltaImageMsg)[] = [
        { type: "line.begin", streamId: "innerStream", timestamp: new Date() },
        {
          type: "delta.image",
          streamId: "test",
          imageId: "img-1",
          imageSeq: 0,
          image: { type: "image", index: 0, image_url: { url: imageUrl1 } },
          choiceSeq: 0,
          deltaSeq: 1,
          index: 0,
          timestamp: new Date(),
        },
        {
          type: "delta.image",
          streamId: "test",
          imageId: "img-2",
          imageSeq: 1,
          image: { type: "image", index: 0, image_url: { url: imageUrl2 } },
          choiceSeq: 0,
          deltaSeq: 2,
          index: 0,
          timestamp: new Date(),
        },
        { type: "line.end", streamId: "innerStream", totalLines: 0, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg | DeltaImageMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      const imageEvents = chunks.filter((c) => isBlockImage(c)) as BlockImageMsg[];
      expect(imageEvents).toHaveLength(2);
      expect(imageEvents[0].url).toBe(imageUrl1);
      expect(imageEvents[1].url).toBe(imageUrl2);

      const endEvent = chunks.find((c) => isBlockEnd(c)) as BlockEndMsg;
      expect(endEvent.stats.image.cnt).toBe(2);
    });

    it("handles mixed images and text content", async () => {
      const imageUrl = "data:image/png;base64,mixed";
      const events: (LineStreamMsg | DeltaImageMsg)[] = [
        { type: "line.begin", streamId: "innerStream", timestamp: new Date() },
        { type: "line.line", streamId: "innerStream", content: "Some text before", lineNr: 1, timestamp: new Date() },
        {
          type: "delta.image",
          streamId: "test",
          imageId: "img-1",
          imageSeq: 0,
          image: { type: "image", index: 0, image_url: { url: imageUrl } },
          choiceSeq: 0,
          deltaSeq: 1,
          index: 0,
          timestamp: new Date(),
        },
        { type: "line.line", streamId: "innerStream", content: "Some text after", lineNr: 2, timestamp: new Date() },
        { type: "line.end", streamId: "innerStream", totalLines: 2, timestamp: new Date() },
      ];

      const input = new ReadableStream<LineStreamMsg | DeltaImageMsg>({
        start(controller) {
          events.forEach((e) => controller.enqueue(e));
          controller.close();
        },
      });

      const output = input.pipeThrough(createBlockStream("test", "innerStream", createId));
      const chunks = await collectStream(output);

      // Should have toplevel, image, and more toplevel content
      const toplevelLines = chunks.filter((c) => isToplevelLine(c)) as ToplevelLineMsg[];
      expect(toplevelLines).toHaveLength(2);

      const imageEvent = chunks.find((c) => isBlockImage(c)) as BlockImageMsg;
      expect(imageEvent).toBeDefined();

      const endEvent = chunks.find((c) => isBlockEnd(c)) as BlockEndMsg;
      expect(endEvent.stats.image.cnt).toBe(1);
      expect(endEvent.stats.toplevel.cnt).toBeGreaterThanOrEqual(1);
    });
  });
});
