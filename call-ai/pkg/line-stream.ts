import { OnFunc } from "@adviser/cement";

// make this us XState
// then implement Nesting { { }}
// them optional implement []
// string " { ", " \"  } "
// emit events allow the reassembly of the json
export enum LineStreamState {
  WaitForOpeningCurlyBracket,
  WaitingForClosingCurlyBracket,
  WaitingForEOL,
}

export class LineStreamParser {
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

  state: LineStreamState;
  constructor(initialState: LineStreamState) {
    this.state = initialState;
  }

  seq = 0;
  lineNr = 0;

  rest = "";
  blockId = 0;

  processChunk(chunk: string) {
    chunk = this.rest + chunk;
    while (true) {
      if (this.state === LineStreamState.WaitForOpeningCurlyBracket) {
        const eolIndex = chunk.indexOf("{");
        if (eolIndex >= 0) {
          chunk = this.rest = chunk.slice(eolIndex + 1);
          this.onBracket.invoke({ type: "bracket", bracket: "open" });
          this.state = LineStreamState.WaitingForClosingCurlyBracket;
        } else {
          this.rest = chunk;
          return;
        }
      }
      if (this.state === LineStreamState.WaitingForClosingCurlyBracket) {
        const eolIndex = chunk.indexOf("}");
        const openEolIndex = chunk.indexOf("{");
        if (eolIndex >= openEolIndex && openEolIndex >= 0) {
          this.state = LineStreamState.WaitForOpeningCurlyBracket;
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
          this.state = LineStreamState.WaitForOpeningCurlyBracket;
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
      } else if (this.state === LineStreamState.WaitingForEOL) {
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
