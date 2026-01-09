import { LineStreamParser, LineStreamState } from "call-ai";
import { expect, vi, it } from "vitest";

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
  const fnBracket = vi.fn();
  so.onBracket(fnBracket);
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    so.processChunk(chunk);
  }
  expect(fnBracket.mock.calls).toEqual([
    [{ type: "bracket", bracket: "open" }],
    // First chunk: "{ part 1 { nes"
    // Open consumed.
    // " part 1 { nes". Scan finds {. Index 8.
    // Emits " part 1 ".
    [{ type: "inBracket", seqStyle: "first", block: 0, seq: 0, content: " part 1 " }],
    // Consumed " part 1 {". Depth 2.
    // Chunk " nes". Scan finds nothing.
    // Emits " nes".
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 1, content: " nes" }],
    // Chunk consumed.

    // Second chunk: "ted } part 2 }"
    // Chunk "ted } part 2 }". Scan finds }. Index 4.
    // Emits "ted ".
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 2, content: "ted " }],
    // Consumes "ted }". Depth 1.
    // Chunk " part 2 }". Scan finds }. Index 8.
    // Depth 1 -> 0. Emits Last.
    [{ type: "inBracket", seqStyle: "last", block: 0, seq: 3, content: " part 2 " }],
    // Consumes " part 2 }". Block incremented.
    [{ type: "bracket", bracket: "close" }],
  ]);
});
