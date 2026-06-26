import { describe, expect, it } from "vitest";
import { makeLineEmitter } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("makeLineEmitter EOF flush", () => {
  it("emits the trailing line that has no terminating newline", () => {
    const lines: { lineNr: number; line: string }[] = [];
    const emit = makeLineEmitter((a) => lines.push({ lineNr: a.lineNr, line: a.line }));
    emit("App.jsx", "a\nb\nc"); // streams "a","b"; "c" has no newline yet
    expect(lines.map((l) => l.line)).toEqual(["a", "b"]);
    emit.flush("App.jsx", "a\nb\nc");
    expect(lines.map((l) => l.line)).toEqual(["a", "b", "c"]);
  });
});
