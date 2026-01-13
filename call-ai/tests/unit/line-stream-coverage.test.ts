import { LineStreamParser, LineStreamState, LineEvent } from "call-ai";
import { expect, it } from "vitest";

it("Coverage-Test: Both brackets in same chunk", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);

  const events: LineEvent[] = [];
  so.onEvent((evt) => events.push(evt));

  so.processChunk("{");
  // Now in waitingForClosingCurlyBracket state

  // This chunk has both { and }
  // scanForBoth should find { first
  so.processChunk(" a { b } c ");

  // Final close
  so.processChunk("}");

  expect(events).toEqual([
    { type: "line.bracket.open" },
    // From "{" chunk: Case C (Found Nothing) emits empty content
    { type: "line.content", seqStyle: "first", block: 0, seq: 0, content: "" },
    // From " a { b } c "
    // 1. Found { at index 3. Emits " a ". Depth 1 -> 2.
    { type: "line.content", seqStyle: "middle", block: 0, seq: 1, content: " a " },
    // 2. Found } at index 2 (of " b } c "). Emits " b ". Depth 2 -> 1.
    { type: "line.content", seqStyle: "middle", block: 0, seq: 2, content: " b " },
    // 3. No more brackets in " c ". Emits " c ". seq 3.
    { type: "line.content", seqStyle: "middle", block: 0, seq: 3, content: " c " },

    // From "}"
    // 4. Found } at index 0. Depth 1 -> 0. Emits last "".
    { type: "line.content", seqStyle: "last", block: 0, seq: 4, content: "" },
    { type: "line.bracket.close" },
  ]);
});

it("Coverage-Test: Close bracket first in chunk", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);

  const events: LineEvent[] = [];
  so.onEvent((evt) => events.push(evt));

  so.processChunk("{ a {");
  // depth 2

  // This chunk has only }
  so.processChunk(" b } c ");

  // Final close
  so.processChunk("}");

  expect(events).toEqual([
    { type: "line.bracket.open" },
    { type: "line.content", seqStyle: "first", block: 0, seq: 0, content: " a " },
    { type: "line.content", seqStyle: "middle", block: 0, seq: 1, content: "" },
    { type: "line.content", seqStyle: "middle", block: 0, seq: 2, content: " b " },
    { type: "line.content", seqStyle: "middle", block: 0, seq: 3, content: " c " },
    { type: "line.content", seqStyle: "last", block: 0, seq: 4, content: "" },
    { type: "line.bracket.close" },
  ]);
});
