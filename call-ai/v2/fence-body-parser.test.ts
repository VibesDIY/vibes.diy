import { describe, expect, it } from "vitest";
import { parseFenceBody } from "./fence-body-parser.js";

describe("parseFenceBody — create blocks", () => {
  it("treats a body with no markers as a single create", () => {
    const r = parseFenceBody(["const x = 1;", "const y = 2;"]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toEqual([{ op: "create", content: "const x = 1;\nconst y = 2;" }]);
  });

  it("preserves blank lines inside a create body", () => {
    const r = parseFenceBody(["a", "", "b"]);
    expect(r.edits).toEqual([{ op: "create", content: "a\n\nb" }]);
  });

  it("handles an empty body as an empty create", () => {
    const r = parseFenceBody([]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toEqual([{ op: "create", content: "" }]);
  });
});

describe("parseFenceBody — replace blocks", () => {
  it("parses a single SEARCH/REPLACE section", () => {
    const r = parseFenceBody(["<<<<<<< SEARCH", "old line", "=======", "new line", ">>>>>>> REPLACE"]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toEqual([{ op: "replace", search: "old line", replace: "new line" }]);
  });

  it("parses multiple SEARCH/REPLACE sections in one fence", () => {
    const r = parseFenceBody([
      "<<<<<<< SEARCH",
      "a1",
      "=======",
      "A1",
      ">>>>>>> REPLACE",
      "<<<<<<< SEARCH",
      "b2",
      "=======",
      "B2",
      ">>>>>>> REPLACE",
    ]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toEqual([
      { op: "replace", search: "a1", replace: "A1" },
      { op: "replace", search: "b2", replace: "B2" },
    ]);
  });

  it("preserves multi-line SEARCH and REPLACE bodies including indentation", () => {
    const r = parseFenceBody([
      "<<<<<<< SEARCH",
      "  function foo() {",
      "    return 1;",
      "  }",
      "=======",
      "  function foo() {",
      "    return 2;",
      "  }",
      ">>>>>>> REPLACE",
    ]);
    expect(r.edits).toEqual([
      {
        op: "replace",
        search: "  function foo() {\n    return 1;\n  }",
        replace: "  function foo() {\n    return 2;\n  }",
      },
    ]);
  });

  it("tolerates trailing whitespace on marker lines", () => {
    const r = parseFenceBody(["<<<<<<< SEARCH   ", "old", "=======\t", "new", ">>>>>>> REPLACE  "]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toHaveLength(1);
  });

  it("ignores blank lines between sections", () => {
    const r = parseFenceBody([
      "<<<<<<< SEARCH",
      "a",
      "=======",
      "A",
      ">>>>>>> REPLACE",
      "",
      "",
      "<<<<<<< SEARCH",
      "b",
      "=======",
      "B",
      ">>>>>>> REPLACE",
    ]);
    expect(r.errors).toEqual([]);
    expect(r.edits).toHaveLength(2);
  });
});

describe("parseFenceBody — error cases", () => {
  it("reports orphan divider with no preceding SEARCH", () => {
    const r = parseFenceBody(["just text", "=======", "more text"]);
    expect(r.errors).toEqual([{ kind: "orphan-divider", lineNr: 2 }]);
  });

  it("reports orphan REPLACE end with no in-progress section", () => {
    const r = parseFenceBody(["text", ">>>>>>> REPLACE"]);
    expect(r.errors).toEqual([{ kind: "orphan-end", lineNr: 2 }]);
  });

  it("reports unterminated SEARCH (missing divider)", () => {
    const r = parseFenceBody(["<<<<<<< SEARCH", "old", "old2"]);
    expect(r.errors).toEqual([{ kind: "unterminated-search", lineNr: 3 }]);
    expect(r.edits).toEqual([]);
  });

  it("reports unterminated REPLACE (missing end marker)", () => {
    const r = parseFenceBody(["<<<<<<< SEARCH", "old", "=======", "new"]);
    expect(r.errors).toEqual([{ kind: "unterminated-replace", lineNr: 4 }]);
    expect(r.edits).toEqual([]);
  });

  it("reports content-before-search when the body starts with non-blank prose then a SEARCH", () => {
    const r = parseFenceBody(["stray text before any marker", "<<<<<<< SEARCH", "old", "=======", "new", ">>>>>>> REPLACE"]);
    expect(r.errors).toContainEqual({ kind: "content-before-search", lineNr: 2 });
    // Section still parses successfully — we record the error but don't drop the edit
    expect(r.edits).toEqual([{ op: "replace", search: "old", replace: "new" }]);
  });

  it("reports content-before-search when stray content sits between two sections", () => {
    const r = parseFenceBody([
      "<<<<<<< SEARCH",
      "a",
      "=======",
      "A",
      ">>>>>>> REPLACE",
      "stray non-blank content",
      "<<<<<<< SEARCH",
      "b",
      "=======",
      "B",
      ">>>>>>> REPLACE",
    ]);
    expect(r.errors).toContainEqual({ kind: "content-before-search", lineNr: 6 });
    expect(r.edits).toHaveLength(2);
  });
});

describe("parseFenceBody — lenient divider-as-end recovery", () => {
  // Models occasionally close a REPLACE block with `=======` instead of
  // `>>>>>>> REPLACE`. Two distinct prompts in the eval/codegen-edit corpus
  // (task-tracker and bookmarks) hit this pattern: a multi-line CSS
  // classNames replace whose closer is a second divider followed by EOF.
  // See eval/codegen-edit/PLAN-parser-fix.md for the archive references.
  //
  // The parser treats any divider in `in-replace` as an implicit end of
  // the replace, emits the edit, and records a soft `divider-as-end`
  // warning so consumers can distinguish lenient recovery from a hard
  // parse failure.
  it("recovers a REPLACE closed with ======= instead of >>>>>>> REPLACE", () => {
    const r = parseFenceBody(["<<<<<<< SEARCH", "old", "=======", "new", "======="]);
    expect(r.edits).toEqual([{ op: "replace", search: "old", replace: "new" }]);
    expect(r.errors).toEqual([{ kind: "divider-as-end", lineNr: 5 }]);
  });

  it("recovers a multi-line REPLACE closed with ======= and trailing blank lines", () => {
    // Mirrors the actual archive pattern: model emits a long REPLACE then
    // closes with ======= and a trailing newline at EOF.
    const r = parseFenceBody([
      "<<<<<<< SEARCH",
      "const classNames = {",
      "  page: 'p-6',",
      "};",
      "=======",
      "const classNames = {",
      "  page: 'p-8 bg-cream',",
      "  header: 'mb-6',",
      "};",
      "=======",
      "",
    ]);
    expect(r.edits).toEqual([
      {
        op: "replace",
        search: "const classNames = {\n  page: 'p-6',\n};",
        replace: "const classNames = {\n  page: 'p-8 bg-cream',\n  header: 'mb-6',\n};",
      },
    ]);
    expect(r.errors).toEqual([{ kind: "divider-as-end", lineNr: 10 }]);
  });

  it("preserves the original unterminated-replace error when no divider closes the section", () => {
    // Regression guard: the existing "unterminated-replace" path stays
    // intact when the model truly forgets to close at all (no second
    // divider, no `>>>>>>> REPLACE`, just EOF mid-replace).
    const r = parseFenceBody(["<<<<<<< SEARCH", "old", "=======", "new"]);
    expect(r.errors).toEqual([{ kind: "unterminated-replace", lineNr: 4 }]);
    expect(r.edits).toEqual([]);
  });
});
