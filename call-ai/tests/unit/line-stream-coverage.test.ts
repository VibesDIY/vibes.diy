import { LineStreamParser, LineStreamState } from "call-ai";
import { expect, vi, it } from "vitest";

it("Coverage-Test: Both brackets in same chunk", async () => {
  const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
  
  const fnBracket = vi.fn();
  so.onBracket(fnBracket);

  so.processChunk("{"); 
  // Now in waitingForClosingCurlyBracket state
  
  // This chunk has both { and }
  // scanForBoth should find { first
  so.processChunk(" a { b } c ");

  // Final close
  so.processChunk("}");

  expect(fnBracket.mock.calls).toEqual([
    [{ type: "bracket", bracket: "open" }],
    // From "{" chunk: Case C (Found Nothing) emits empty content
    [{ type: "inBracket", seqStyle: "first", block: 0, seq: 0, content: "" }],
    // From " a { b } c "
    // 1. Found { at index 3. Emits " a ". Depth 1 -> 2.
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 1, content: " a " }],
    // 2. Found } at index 2 (of " b } c "). Emits " b ". Depth 2 -> 1.
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 2, content: " b " }],
    // 3. No more brackets in " c ". Emits " c ". seq 3.
    [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 3, content: " c " }],
    
    // From "}"
    // 4. Found } at index 0. Depth 1 -> 0. Emits last "".
    [{ type: "inBracket", seqStyle: "last", block: 0, seq: 4, content: "" }],
    [{ type: "bracket", bracket: "close" }],
  ]);
});

it("Coverage-Test: Close bracket first in chunk", async () => {
    const so = new LineStreamParser(LineStreamState.WaitForOpeningCurlyBracket);
    
    const fnBracket = vi.fn();
    so.onBracket(fnBracket);
  
    so.processChunk("{ a {"); 
    // depth 2
    
    // This chunk has only }
    so.processChunk(" b } c ");
  
    // Final close
    so.processChunk("}");
  
    expect(fnBracket.mock.calls).toEqual([
      [{ type: "bracket", bracket: "open" }],
      [{ type: "inBracket", seqStyle: "first", block: 0, seq: 0, content: " a " }],
      [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 1, content: "" }],
      [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 2, content: " b " }],
      [{ type: "inBracket", seqStyle: "middle", block: 0, seq: 3, content: " c " }],
      [{ type: "inBracket", seqStyle: "last", block: 0, seq: 4, content: "" }],
      [{ type: "bracket", bracket: "close" }],
    ]);
  });
