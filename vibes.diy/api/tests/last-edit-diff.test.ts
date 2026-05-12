import { describe, it, expect } from "vitest";
import { lineDiff, coalesceHunks } from "../svc/intern/last-edit-diff.js";

describe("lineDiff", () => {
  it("returns empty hunks for identical inputs", () => {
    expect(lineDiff("a\nb\nc", "a\nb\nc")).toEqual([]);
  });

  it("returns one hunk for a single-line change", () => {
    const hunks = lineDiff("a\nb\nc", "a\nX\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldLines).toEqual(["b"]);
    expect(hunks[0].newLines).toEqual(["X"]);
    expect(hunks[0].oldStart).toBe(1); // 0-indexed
  });

  it("returns two hunks for two disjoint changes >3 lines apart", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh";
    const after = "a\nB\nc\nd\ne\nf\ng\nH";
    const hunks = lineDiff(before, after);
    expect(hunks).toHaveLength(2);
  });
});

describe("coalesceHunks", () => {
  it("merges hunks within 3 unchanged lines", () => {
    const hunks = [
      { oldStart: 1, oldLines: ["b"], newLines: ["B"] },
      { oldStart: 3, oldLines: ["d"], newLines: ["D"] },
    ];
    const merged = coalesceHunks(hunks, ["a", "b", "c", "d", "e"], 3);
    expect(merged).toHaveLength(1);
    expect(merged[0].oldLines).toEqual(["b", "c", "d"]);
    expect(merged[0].newLines).toEqual(["B", "c", "D"]);
  });

  it("does not merge hunks >3 unchanged lines apart", () => {
    const hunks = [
      { oldStart: 1, oldLines: ["b"], newLines: ["B"] },
      { oldStart: 6, oldLines: ["g"], newLines: ["G"] },
    ];
    const merged = coalesceHunks(hunks, ["a", "b", "c", "d", "e", "f", "g"], 3);
    expect(merged).toHaveLength(2);
  });
});
