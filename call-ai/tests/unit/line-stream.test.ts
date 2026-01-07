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
