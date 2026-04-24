import { describe, expect, it } from "vitest";
import { applyEdits, applyReplace } from "./apply-edits.js";

describe("applyReplace", () => {
  it("replaces a unique match", () => {
    const r = applyReplace("hello world", "world", "there");
    expect(r).toEqual({ ok: true, content: "hello there" });
  });

  it("fails with no-match when old is absent", () => {
    const r = applyReplace("hello world", "xyz", "abc");
    expect(r).toEqual({ ok: false, reason: "no-match", matchCount: 0 });
  });

  it("fails with multiple-match when old appears twice", () => {
    const r = applyReplace("ab ab", "ab", "cd");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("multiple-match");
      expect(r.matchCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("treats empty old as no-match", () => {
    const r = applyReplace("hello", "", "x");
    expect(r).toEqual({ ok: false, reason: "no-match", matchCount: 0 });
  });

  it("preserves whitespace and indentation exactly", () => {
    const src = "line1\n  line2\nline3";
    const r = applyReplace(src, "  line2", "  LINE2");
    expect(r).toEqual({ ok: true, content: "line1\n  LINE2\nline3" });
  });
});

describe("applyEdits", () => {
  it("applies a create then a sequence of replaces", () => {
    const edits = [
      { op: "create" as const, content: "const a = 1;\nconst b = 2;\n" },
      { op: "replace" as const, old: "const a = 1;", new: "const a = 10;" },
      { op: "replace" as const, old: "const b = 2;", new: "const b = 20;" },
    ];
    const r = applyEdits("", edits);
    expect(r.content).toBe("const a = 10;\nconst b = 20;\n");
    expect(r.errors).toEqual([]);
  });

  it("uses seed when first edit is a replace", () => {
    const seed = "hello world";
    const r = applyEdits(seed, [{ op: "replace", old: "world", new: "there" }]);
    expect(r.content).toBe("hello there");
    expect(r.errors).toEqual([]);
  });

  it("collects failures and continues with unchanged source", () => {
    const seed = "one two three";
    const r = applyEdits(seed, [
      { op: "replace", old: "missing", new: "x" },
      { op: "replace", old: "two", new: "TWO" },
      { op: "replace", old: "e", new: "E" },
    ]);
    expect(r.content).toBe("one TWO three");
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({ index: 0, reason: "no-match" });
    expect(r.errors[1]).toMatchObject({ index: 2, reason: "multiple-match" });
  });

  it("create after replaces resets content", () => {
    const r = applyEdits("original", [
      { op: "replace", old: "original", new: "edited" },
      { op: "create", content: "fresh" },
    ]);
    expect(r.content).toBe("fresh");
    expect(r.errors).toEqual([]);
  });
});
