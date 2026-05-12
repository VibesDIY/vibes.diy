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

  it("regression: no-ellipsis SEARCH uses exact path", () => {
    const r = applyReplace({ source: "alpha\nbeta\ngamma", search: "beta", replace: "BETA" });
    expect(r).toEqual({ ok: true, matchKind: "exact", content: "alpha\nBETA\ngamma" });
  });
});

describe("applyReplace ellipsis", () => {
  it("matches a longer source line via trailing ... prefix", () => {
    const source = 'before\n  <div className="foo bar baz qux">\nafter';
    const search = '  <div className="foo...';
    const replace = '  <div className="X">';
    const r = applyReplace({ source, search, replace });
    expect(r).toEqual({
      ok: true,
      matchKind: "ellipsis",
      content: 'before\n  <div className="X">\nafter',
    });
  });

  it("matches a block with a prefix line among anchors", () => {
    const source = [
      "function FeatureOne() {",
      '  return <div className="rounded-lg bg-blue-500 p-4 shadow">',
      "    Hello",
      "  </div>;",
      "}",
    ].join("\n");
    const search = ["function FeatureOne() {", '  return <div className="rounded...', "    Hello", "  </div>;", "}"].join("\n");
    const replace = "function FeatureOne() {\n  return <div>NEW</div>;\n}";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matchKind).toBe("ellipsis");
      expect(r.content).toBe(replace);
    }
  });

  it("reports multiple-match when a prefix matches in two places", () => {
    const source = '<div className="foo a">\n<div className="foo b">';
    const r = applyReplace({
      source,
      search: '<div className="foo...',
      replace: "X",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("multiple-match");
  });

  it("matches with a skip line consuming intervening content", () => {
    const source = "function foo() {\n  body1;\n  body2;\n}";
    const search = "function foo() {\n  ...rest of body\n}";
    const replace = "function foo() {\n  return 42;\n}";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.matchKind).toBe("ellipsis");
      expect(r.content).toBe(replace);
    }
  });

  it("accepts skip = 0 between adjacent anchors", () => {
    const source = "open\nclose";
    const search = "open\n...\nclose";
    const replace = "DONE";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("DONE");
  });

  it("rejects ambiguous skip lengths as multiple-match", () => {
    const source = "foo\nx\nbar\ny\nbar";
    const search = "foo\n...\nbar";
    const r = applyReplace({ source, search, replace: "Z" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("multiple-match");
  });

  it("collapses adjacent skip lines", () => {
    const source = "foo\na\nb\nc\nbar";
    const search = "foo\n...\n...\nbar";
    const replace = "BAZ";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("BAZ");
  });

  it("ignores trailing comment text after leading ...", () => {
    const source = "function foo() {\n  body;\n}";
    const search = "function foo() {\n  ...rest of body\n}";
    const replace = "function foo() {}";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe(replace);
  });

  it("middle skip consumes intervening lines into the replaced range", () => {
    const source = "foo\nx\ny\nbar";
    const search = "foo\n...\nbar";
    const replace = "qux";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("qux");
  });

  it("treats ... in the middle of a SEARCH line as literal anchor content", () => {
    const source = 'console.log("a ... b");\nother';
    const search = 'console.log("a ... b");';
    const replace = 'console.log("done");';
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // No ellipsis tokens involved → exact path, not "ellipsis".
      expect(r.matchKind).toBe("exact");
      expect(r.content).toBe('console.log("done");\nother');
    }
  });

  it("does not match a SEARCH with mid-line ... against a source line missing the ...", () => {
    const source = 'console.log("a b");\nother';
    const search = 'console.log("a ... b");';
    const r = applyReplace({ source, search, replace: "X" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-match");
  });

  it("passes ... in REPLACE through verbatim", () => {
    const source = "before\nplaceholder\nafter";
    const search = "placeholder";
    const replace = "now ... done";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe("before\nnow ... done\nafter");
  });

  it("leading-... on REPLACE stays literal when SEARCH has no inter-segment skip to mirror", () => {
    const source = 'foo\n  <div className="long tail">\nbar';
    const search = '  <div className="long...';
    const replace = "  ...kept literal";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    // SEARCH uses trailing-... only (no leading/inter-segment skip), so the
    // leading-... line on REPLACE has no captured skip to substitute → literal.
    if (r.ok) expect(r.content).toBe("foo\n  ...kept literal\nbar");
  });

  it("trailing-... on REPLACE reuses the SEARCH-side captured suffix", () => {
    const source = "  .btn { color: red; padding: 0.6rem 1.2rem; font-size: 0.78rem; cursor: pointer; }\nother";
    const search = "  .btn { color: red; padding: 0.6rem 1.2rem; font-size: 0.78rem;...";
    const replace = "  .btn { color: red; padding: 0.6rem 1.2rem; font-size: 0.92rem;...";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe("  .btn { color: red; padding: 0.6rem 1.2rem; font-size: 0.92rem; cursor: pointer; }\nother");
    }
  });

  it("trailing-... mirror pairs prefix-... lines by ordinal", () => {
    const source = [
      "function CardHeader() {",
      '  return <h2 className="text-2xl font-bold tracking-tight">{title}</h2>;',
      "}",
      "function CardBody() {",
      '  return <div className="prose max-w-none mt-4">{children}</div>;',
      "}",
    ].join("\n");
    const search = [
      "function CardHeader() {",
      '  return <h2 className="text-2xl...',
      "}",
      "function CardBody() {",
      '  return <div className="prose...',
      "}",
    ].join("\n");
    const replace = [
      "function CardHeader() {",
      '  return <h2 className="text-4xl...',
      "}",
      "function CardBody() {",
      '  return <div className="prose-lg...',
      "}",
    ].join("\n");
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe(
        [
          "function CardHeader() {",
          '  return <h2 className="text-4xl font-bold tracking-tight">{title}</h2>;',
          "}",
          "function CardBody() {",
          '  return <div className="prose-lg max-w-none mt-4">{children}</div>;',
          "}",
        ].join("\n")
      );
    }
  });

  it("trailing-... on REPLACE without a SEARCH counterpart stays literal", () => {
    const source = "foo\nplain anchor line\nbar";
    const search = "plain anchor line";
    const replace = "literal ... tail\nliteral end...";
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    // No SEARCH prefix-`...` to capture from → REPLACE is verbatim, even trailing `...`.
    if (r.ok) expect(r.content).toBe("foo\nliteral ... tail\nliteral end...\nbar");
  });

  it("leading-... on REPLACE mirrors the SEARCH-side inter-segment skip", () => {
    const source = [
      "const styles = {",
      '  title: "old-title",',
      '  middle1: "keep1",',
      '  middle2: "keep2",',
      '  footer: "old-footer",',
      "};",
    ].join("\n");
    const search = ['  title: "old-title",', "...", '  footer: "old-footer",'].join("\n");
    const replace = ['  title: "new-title",', "...", '  footer: "new-footer",'].join("\n");
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe(
        [
          "const styles = {",
          '  title: "new-title",',
          '  middle1: "keep1",',
          '  middle2: "keep2",',
          '  footer: "new-footer",',
          "};",
        ].join("\n")
      );
    }
  });

  it("multiple leading-... on REPLACE pair by ordinal with multiple SEARCH skips", () => {
    const source = ["  a: 1,", "  middleA: 2,", "  b: 3,", "  middleB1: 4,", "  middleB2: 5,", "  c: 6,"].join("\n");
    const search = ["  a: 1,", "...", "  b: 3,", "...", "  c: 6,"].join("\n");
    const replace = ["  a: 10,", "...", "  b: 30,", "...", "  c: 60,"].join("\n");
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe(["  a: 10,", "  middleA: 2,", "  b: 30,", "  middleB1: 4,", "  middleB2: 5,", "  c: 60,"].join("\n"));
    }
  });

  it("mid-line ... on REPLACE stays literal even when SEARCH has trailing-...", () => {
    const source = 'foo\n  log("debug", value, ctx);\nbar';
    const search = '  log("debug",...';
    const replace = '  log("info", a ... b, ctx);';
    const r = applyReplace({ source, search, replace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.content).toBe('foo\n  log("info", a ... b, ctx);\nbar');
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
