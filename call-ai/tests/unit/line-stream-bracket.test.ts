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

it("Empty-Content-Test - should emit empty middle events", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  const lines = new ReadableStream<string>({
    async start(controller) {
      // Simple case: { content } where we send chunks that create empty middle
      controller.enqueue("{ a"); // open + first with "a"
      controller.enqueue(""); // empty chunk - should emit empty middle with seq 1
      controller.enqueue(" b }"); // last with " b"
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
