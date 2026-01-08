import { LineStreamParser, LineStreamState } from "call-ai";
import { expect, vi, it } from "vitest";

it("Bracket-Test", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      for (let i = 0; i < 2; i++) {
        controller.enqueue("{ Begin " + i);
        controller.enqueue("  Middle " + i);
        controller.enqueue("  End " + i + " }");
      }
      controller.enqueue("FragmentLine 1\nFragmentLine 2");
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
    [
      {
        bracket: "open",
        type: "bracket",
      },
    ],
    [
      {
        block: 0,
        content: " Begin 0",
        seq: 0,
        seqStyle: "first",
        type: "inBracket",
      },
    ],
    [
      {
        block: 0,
        content: "  Middle 0",
        seq: 1,
        seqStyle: "middle",
        type: "inBracket",
      },
    ],
    [
      {
        block: 0,
        content: "  End 0 ",
        seq: 2,
        seqStyle: "last",
        type: "inBracket",
      },
    ],
    [
      {
        bracket: "close",
        type: "bracket",
      },
    ],
    [
      {
        bracket: "open",
        type: "bracket",
      },
    ],
    [
      {
        block: 1,
        content: " Begin 1",
        seq: 0,
        seqStyle: "first",
        type: "inBracket",
      },
    ],
    [
      {
        block: 1,
        content: "  Middle 1",
        seq: 1,
        seqStyle: "middle",
        type: "inBracket",
      },
    ],
    [
      {
        block: 1,
        content: "  End 1 ",
        seq: 2,
        seqStyle: "last",
        type: "inBracket",
      },
    ],
    [
      {
        bracket: "close",
        type: "bracket",
      },
    ],
  ]);
});

it("EOL-Test", async () => {
  const so = new LineStreamParser(LineStreamState.WaitingForEOL);
  const lines = new ReadableStream<string>({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue("Line " + i);
      }
      controller.enqueue("FragmentLine 1\nFragmentLine 2");
      controller.close();
    },
  });
  const reader = lines.getReader();
  const fn = vi.fn();
  so.onFragment(fn);
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    so.processChunk(chunk);
  }
  expect(fn.mock.calls).toEqual([
    [
      {
        fragment: "Line 0",
        lineComplete: false,
        lineNr: 0,
        seq: 0,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 1",
        lineComplete: false,
        lineNr: 0,
        seq: 1,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 2",
        lineComplete: false,
        lineNr: 0,
        seq: 2,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 3",
        lineComplete: false,
        lineNr: 0,
        seq: 3,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 4",
        lineComplete: false,
        lineNr: 0,
        seq: 4,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 5",
        lineComplete: false,
        lineNr: 0,
        seq: 5,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 6",
        lineComplete: false,
        lineNr: 0,
        seq: 6,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 7",
        lineComplete: false,
        lineNr: 0,
        seq: 7,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 8",
        lineComplete: false,
        lineNr: 0,
        seq: 8,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "Line 9",
        lineComplete: false,
        lineNr: 0,
        seq: 9,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "FragmentLine 1",
        lineComplete: true,
        lineNr: 0,
        seq: 10,
        type: "fragment",
      },
    ],
    [
      {
        fragment: "FragmentLine 2",
        lineComplete: false,
        lineNr: 1,
        seq: 0,
        type: "fragment",
      },
    ],
  ]);
});

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

it("Empty-Content-Test - should emit empty middle events", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      // Simple case: { content } where we send chunks that create empty middle
      controller.enqueue("{ a");    // open + first with "a"
      controller.enqueue("");       // empty chunk - should emit empty middle with seq 1
      controller.enqueue(" b }");   // last with " b"
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
  // Empty middle events should NOT be filtered out
  // Expected: open, first(" a"), middle(""), last(" b "), close
  expect(fnBracket.mock.calls).toEqual([
    [{ type: "bracket", bracket: "open" }],
    [{ type: "inBracket", seqStyle: "first", block: 0, seq: 0, content: " a" }],
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 1, content: "" }],
    [{ type: "inBracket", seqStyle: "last", block: 0, seq: 2, content: " b " }],
    [{ type: "bracket", bracket: "close" }],
  ]);
});
