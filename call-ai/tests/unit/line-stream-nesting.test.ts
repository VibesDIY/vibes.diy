import { LineEvent } from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { expect, it } from "vitest";

it("Nesting-Test", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      // { part 1 { nested } part 2 }
      controller.enqueue("{ part 1 { nes");
      controller.enqueue("ted } part 2 }");
      controller.close();
    },
  });
  const reader = lines.getReader();
  const events: LineEvent[] = [];
  so.onEvent((evt) => events.push(evt));
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    so.processChunk(chunk);
  }
  expect(events).toEqual([
    { type: "line.bracket.open" },
    // First chunk: "{ part 1 { nes"
    // Open consumed.
    // " part 1 { nes". Scan finds {. Index 8.
    // Emits " part 1 ".
    { type: "line.content", seqStyle: "first", block: 0, seq: 0, content: " part 1 " },
    // Consumed " part 1 {". Depth 2.
    // Chunk " nes". Scan finds nothing.
    // Emits " nes".
    { type: "line.content", seqStyle: "middle", block: 0, seq: 1, content: " nes" },
    // Chunk consumed.

    // Second chunk: "ted } part 2 }"
    // Chunk "ted } part 2 }". Scan finds }. Index 4.
    // Emits "ted ".
    { type: "line.content", seqStyle: "middle", block: 0, seq: 2, content: "ted " },
    // Consumes "ted }". Depth 1.
    // Chunk " part 2 }". Scan finds }. Index 8.
    // Depth 1 -> 0. Emits Last.
    { type: "line.content", seqStyle: "last", block: 0, seq: 3, content: " part 2 " },
    // Consumes " part 2 }". Block incremented.
    { type: "line.bracket.close" },
  ]);
});
