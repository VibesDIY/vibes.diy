import { describe, expect, it } from "vitest";
import { applyEdits, applyReplace } from "./apply-edits.js";

describe("applyReplace", () => {
  it("replaces a unique exact match", () => {
    const r = applyReplace({ source: "hello world", search: "world", replace: "there" });
    expect(r).toEqual({ ok: true, matchKind: "exact", content: "hello there" });
  });

  it("fails with no-match when search is absent", () => {
    const r = applyReplace({ source: "hello world", search: "xyz", replace: "abc" });
    expect(r).toEqual({ ok: false, reason: "no-match", matchCount: 0 });
  });

  it("fails with multiple-match when search appears twice", () => {
    const r = applyReplace({ source: "ab ab", search: "ab", replace: "cd" });
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toBe("multiple-match");
      expect(r.matchCount).toBe(2);
    }
  });

  it("treats empty search as no-match", () => {
    const r = applyReplace({ source: "hello", search: "", replace: "x" });
    expect(r).toEqual({ ok: false, reason: "no-match", matchCount: 0 });
  });

  it("preserves whitespace and indentation on exact match", () => {
    const r = applyReplace({
      source: "line1\n  line2\nline3",
      search: "  line2",
      replace: "  LINE2",
    });
    expect(r).toEqual({ ok: true, matchKind: "exact", content: "line1\n  LINE2\nline3" });
  });

  it("falls back to trailing-whitespace-tolerant match", () => {
    const r = applyReplace({ source: "foo   \nbar\nbaz", search: "foo\nbar", replace: "FOO\nBAR" });
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(r.matchKind).toBe("trailing-ws");
      expect(r.content).toBe("FOO\nBAR\nbaz");
    }
  });

  it("tolerant fallback still reports multiple-match", () => {
    const r = applyReplace({ source: "foo  \nfoo\t\nend", search: "foo", replace: "X" });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("multiple-match");
  });
});

describe("applyEdits", () => {
  it("applies a create then a sequence of replaces", () => {
    const edits = [
      { op: "create" as const, content: "const a = 1;\nconst b = 2;\n" },
      { op: "replace" as const, search: "const a = 1;", replace: "const a = 10;" },
      { op: "replace" as const, search: "const b = 2;", replace: "const b = 20;" },
    ];
    const r = applyEdits("", edits);
    expect(r.content).toBe("const a = 10;\nconst b = 20;\n");
    expect(r.errors).toEqual([]);
  });

  it("uses seed when first edit is a replace", () => {
    const seed = "hello world";
    const r = applyEdits(seed, [{ op: "replace", search: "world", replace: "there" }]);
    expect(r.content).toBe("hello there");
    expect(r.errors).toEqual([]);
  });

  it("collects failures and continues with unchanged source", () => {
    const seed = "one two three";
    const r = applyEdits(seed, [
      { op: "replace", search: "missing", replace: "x" },
      { op: "replace", search: "two", replace: "TWO" },
      { op: "replace", search: "e", replace: "E" },
    ]);
    expect(r.content).toBe("one TWO three");
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({ index: 0, reason: "no-match" });
    expect(r.errors[1]).toMatchObject({ index: 2, reason: "multiple-match" });
  });

  it("create after replaces resets content", () => {
    const r = applyEdits("original", [
      { op: "replace", search: "original", replace: "edited" },
      { op: "create", content: "fresh" },
    ]);
    expect(r.content).toBe("fresh");
    expect(r.errors).toEqual([]);
  });
});
