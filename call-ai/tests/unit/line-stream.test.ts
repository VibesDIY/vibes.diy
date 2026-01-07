import { OnFunc } from "@adviser/cement";
import { expect, vi, it } from "vitest";

// make this us XState
// then implement Nesting { { }}
// them optional implement []
// string " { ", " \"  } "
// emit events allow the reassembly of the json
enum State {
  WaitForOpeningCurlyBracket,
  WaitingForClosingCurlyBracket,
  WaitingForEOL,
}

class StateObject {
  readonly onFragment =
    OnFunc<(f: { type: "fragment"; lineNr: number; fragment: string; seq: number; lineComplete: boolean }) => void>();

  readonly onBracket = OnFunc<
    (
      b:
        | {
            type: "inBracket";
            seqStyle: "first" | "last" | "middle";
            // level: number; // 0, 1, 2, ...
            block: number;
            seq: number;
            content: string;
          }
        | { type: "bracket"; bracket: "open" | "close" },
    ) => void
  >();

  state: State;
  constructor(initialState: State) {
    this.state = initialState;
  }

  seq = 0;
  lineNr = 0;

  rest = "";
  blockId = 0;

  processChunk(chunk: string) {
    chunk = this.rest + chunk;
    while (true) {
      if (this.state === State.WaitForOpeningCurlyBracket) {
        const eolIndex = chunk.indexOf("{");
        if (eolIndex >= 0) {
          chunk = this.rest = chunk.slice(eolIndex + 1);
          this.onBracket.invoke({ type: "bracket", bracket: "open" });
          this.state = State.WaitingForClosingCurlyBracket;
        } else {
          this.rest = chunk;
          return;
        }
      }
      if (this.state === State.WaitingForClosingCurlyBracket) {
        const eolIndex = chunk.indexOf("}");
        const openEolIndex = chunk.indexOf("{");
        if (eolIndex >= openEolIndex && openEolIndex >= 0) {
          this.state = State.WaitForOpeningCurlyBracket;
          continue;
        }
        if (eolIndex >= 0) {
          this.onBracket.invoke({
            type: "inBracket",
            seqStyle: "last",
            block: this.blockId,
            seq: this.seq++,
            content: chunk.slice(0, eolIndex),
          });
          this.rest = chunk.slice(eolIndex + 1);
          this.blockId++;
          this.seq = 0;
          this.onBracket.invoke({ type: "bracket", bracket: "close" });
          this.state = State.WaitForOpeningCurlyBracket;
        } else {
          this.rest = "";
          this.onBracket.invoke({
            seqStyle: this.seq === 0 ? "first" : "middle",
            type: "inBracket",
            block: this.blockId,
            seq: this.seq++,
            content: chunk,
          });
        }
        return;
      } else if (this.state === State.WaitingForEOL) {
        const eolIndex = chunk.indexOf("\n");
        if (eolIndex >= 0) {
          this.onFragment.invoke({
            type: "fragment",
            lineNr: this.lineNr,
            fragment: chunk.slice(0, eolIndex),
            seq: this.seq,
            lineComplete: true,
          });
          this.seq = 0;
          this.lineNr++;
          chunk = chunk.slice(eolIndex + 1);
        } else {
          this.onFragment.invoke({
            type: "fragment",
            lineNr: this.lineNr,
            fragment: chunk,
            seq: this.seq++,
            lineComplete: false,
          });
          return;
        }
      }
    }
  }
}
it("Bracket-Test", async () => {
  const so = new StateObject(State.WaitForOpeningCurlyBracket);
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
  const so = new StateObject(State.WaitingForEOL);
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
