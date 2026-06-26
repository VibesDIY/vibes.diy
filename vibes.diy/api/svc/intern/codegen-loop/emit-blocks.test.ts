import { describe, it, expect } from "vitest";
import { buildBlockEvents } from "./emit-blocks.js";

describe("buildBlockEvents", () => {
  it("emits begin → per-file code.begin/line*/end → block.end", () => {
    let seq = 0;
    const events = buildBlockEvents([{ filename: "/App.jsx", lang: "jsx", content: "line1\nline2" }], {
      blockId: "B1",
      streamId: "P1",
      sectionIdFor: () => "S1",
      nextSeq: () => seq++,
      blockNr: 0,
      byteLength: (s) => s.length,
      usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(["block.begin", "block.code.begin", "block.code.line", "block.code.line", "block.code.end", "block.end"]);
    const lines = events.filter((e) => e.type === "block.code.line") as { line: string; lineNr: number }[];
    expect(lines.map((l) => l.line)).toEqual(["line1", "line2"]);
    expect(lines.map((l) => l.lineNr)).toEqual([0, 1]);
  });
});
