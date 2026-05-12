import { describe, it, expect } from "vitest";
import {
  lineDiff,
  coalesceHunks,
  renderHunkAsSearchReplace,
  generateFileLastEdit,
  generateLastEditBlock,
} from "../svc/intern/last-edit-diff.js";

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

describe("renderHunkAsSearchReplace", () => {
  it("emits SEARCH/REPLACE block for a unique anchor", () => {
    const hunk = { oldStart: 1, oldLines: ["b"], newLines: ["B"] };
    const out = renderHunkAsSearchReplace(hunk, ["a", "b", "c"], 20);
    expect(out.ok).toBe(true);
    expect(out.text).toContain("<<<<<<< SEARCH");
    expect(out.text).toContain("b");
    expect(out.text).toContain("=======");
    expect(out.text).toContain("B");
    expect(out.text).toContain(">>>>>>> REPLACE");
  });

  it("expands context until the SEARCH is unique", () => {
    const hunk = { oldStart: 0, oldLines: ["x"], newLines: ["Y"] };
    // "x" appears twice; needs neighbor context.
    const oldArr = ["x", "next1", "ignore", "x", "next2"];
    const out = renderHunkAsSearchReplace(hunk, oldArr, 20);
    expect(out.ok).toBe(true);
    expect(out.text).toContain("next1");
  });

  it("returns ok=false when 20 lines of context still don't disambiguate", () => {
    const repetitive = Array.from({ length: 30 }, () => "x")
      .join("\n")
      .split("\n");
    const hunk = { oldStart: 0, oldLines: ["x"], newLines: ["Y"] };
    const out = renderHunkAsSearchReplace(hunk, repetitive, 20);
    expect(out.ok).toBe(false);
  });
});

describe("generateFileLastEdit", () => {
  it("returns wholesale indicator on >20 hunks", () => {
    const lines: string[] = [];
    for (let i = 0; i < 150; i++) {
      lines.push(`line${i}`);
    }
    const before = lines.join("\n");
    // Create 25 scattered hunks by changing every 6th line (gap of 5 unchanged lines between)
    const afterLines = lines.slice();
    for (let i = 0; i < afterLines.length; i += 6) {
      afterLines[i] = `CHANGED${i}`;
    }
    const after = afterLines.join("\n");
    const out = generateFileLastEdit("App.jsx", before, after);
    expect(out).toBe("[App.jsx: wholesale rewrite, see PREVIOUS]");
  });

  it("returns NEW FILE marker when before is empty", () => {
    const out = generateFileLastEdit("Card.jsx", "", "<div/>");
    expect(out).toBe("[NEW FILE: Card.jsx — see PREVIOUS]");
  });

  it("returns DELETED marker when after is empty", () => {
    const out = generateFileLastEdit("Card.jsx", "<div/>", "");
    expect(out).toBe("[DELETED: Card.jsx]");
  });

  it("returns SEARCH/REPLACE blocks for ≤20 small hunks", () => {
    const out = generateFileLastEdit("App.jsx", "a\nb\nc", "a\nB\nc");
    expect(out).toContain("App.jsx:");
    expect(out).toContain("<<<<<<< SEARCH");
    expect(out).toContain(">>>>>>> REPLACE");
  });
});

describe("generateLastEditBlock", () => {
  const m = (entries: Record<string, string>) => new Map<string, string>(Object.entries(entries));

  it("returns empty string when no files changed", () => {
    expect(generateLastEditBlock(m({ "/App.jsx": "a" }), m({ "/App.jsx": "a" }))).toBe("");
  });

  it("renders one file's edit", () => {
    const out = generateLastEditBlock(m({ "/App.jsx": "a\nb\nc" }), m({ "/App.jsx": "a\nB\nc" }));
    expect(out).toContain("/App.jsx:");
    expect(out).toContain("<<<<<<< SEARCH");
  });

  it("renders multiple files, one block per file", () => {
    const prev2 = m({ "/App.jsx": "a", "/Card.jsx": "c" });
    const prev = m({ "/App.jsx": "A", "/Card.jsx": "C" });
    const out = generateLastEditBlock(prev2, prev);
    expect(out).toContain("/App.jsx:");
    expect(out).toContain("/Card.jsx:");
  });

  it("includes file deletion and creation markers", () => {
    const prev2 = m({ "/A.jsx": "a", "/Gone.jsx": "g" });
    const prev = m({ "/A.jsx": "a", "/New.jsx": "n" });
    const out = generateLastEditBlock(prev2, prev);
    expect(out).toContain("[DELETED: /Gone.jsx]");
    expect(out).toContain("[NEW FILE: /New.jsx");
    expect(out).not.toContain("/A.jsx:"); // unchanged → skipped
  });
});
