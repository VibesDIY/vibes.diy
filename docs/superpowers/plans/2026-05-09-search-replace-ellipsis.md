# SEARCH/REPLACE Ellipsis Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the SEARCH/REPLACE matcher to support `...` as a single-line prefix shortcut (line ends with `...`) and a multi-line skip (line starts with `...`), while preserving the existing exactly-one-match correctness property.

**Architecture:** All matching logic lives in `call-ai/v2/apply-edits.ts`. When the SEARCH contains no `...` token, the existing fast path runs unchanged. When it does, we route to a line-pattern matcher: split SEARCH into segments separated by skip lines, slide each segment across the source enumerating all valid `(start_1, …, start_n)` tuples, and require exactly one. Match-range replacement uses character offsets reconstructed from line spans, so middle skips consume their content into the replaced range.

**Tech Stack:** TypeScript, vitest. The module is `@vibes.diy/call-ai-v2`. Tests run from `call-ai/v2/`.

**Spec:** [docs/superpowers/specs/2026-05-09-search-replace-ellipsis-design.md](../specs/2026-05-09-search-replace-ellipsis-design.md)

---

## File Structure

- Modify: [call-ai/v2/apply-edits.ts](../../../call-ai/v2/apply-edits.ts) — add ellipsis detection, line-pattern matcher, segment enumerator. Single file, single responsibility (matching + applying edits) preserved.
- Modify: [call-ai/v2/apply-edits.test.ts](../../../call-ai/v2/apply-edits.test.ts) — new tests, existing tests must keep passing unchanged.
- Modify: [prompts/pkg/system-prompt.md](../../../prompts/pkg/system-prompt.md) — short addendum teaching the model the shortcuts.

No new files. No changes to consumers (`CodeEditor.tsx`, recovery code, etc.) — they consume `applyReplace` and are agnostic to `matchKind`.

---

### Task 1: Add ellipsis detection and route to stub

**Files:**
- Modify: `call-ai/v2/apply-edits.ts`
- Modify: `call-ai/v2/apply-edits.test.ts`

Goal: add the `"ellipsis"` matchKind, a predicate that detects whether a SEARCH uses `...` tokens, and route ellipsis-flavored SEARCHes to a stub that returns `no-match`. Confirm the regression suite (existing tests) still passes.

- [ ] **Step 1: Write a regression test that pins the existing matchKind union**

In `apply-edits.test.ts`, add inside the `describe("applyReplace", ...)` block:

```ts
it("regression: no-ellipsis SEARCH uses exact path", () => {
  const r = applyReplace({ source: "alpha\nbeta\ngamma", search: "beta", replace: "BETA" });
  expect(r).toEqual({ ok: true, matchKind: "exact", content: "alpha\nBETA\ngamma" });
});
```

- [ ] **Step 2: Run tests and confirm everything still passes**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits`
Expected: all tests pass (regression assertion is just exercise of current behavior).

- [ ] **Step 3: Add ellipsis detection helper and matchKind**

In `apply-edits.ts`, change:

```ts
export interface ApplyEditOk {
  readonly ok: true;
  readonly content: string;
  readonly matchKind: "exact" | "trailing-ws";
}
```

to:

```ts
export interface ApplyEditOk {
  readonly ok: true;
  readonly content: string;
  readonly matchKind: "exact" | "trailing-ws" | "ellipsis";
}
```

Below `rstripLines`, add:

```ts
type LineKind = "anchor" | "prefix" | "skip";

interface ClassifiedLine {
  readonly kind: LineKind;
  readonly text: string;
  readonly prefix: string;
}

function classifyLine(rawLine: string): ClassifiedLine {
  const trimmed = rawLine.replace(/[ \t]+$/, "");
  if (trimmed.startsWith("...")) {
    return { kind: "skip", text: rawLine, prefix: "" };
  }
  if (trimmed.endsWith("...") && trimmed.length >= 3) {
    return { kind: "prefix", text: rawLine, prefix: trimmed.slice(0, -3) };
  }
  return { kind: "anchor", text: rawLine, prefix: "" };
}

function hasEllipsisToken(search: string): boolean {
  return search.split("\n").some((l) => {
    const k = classifyLine(l).kind;
    return k === "prefix" || k === "skip";
  });
}
```

In `applyReplace`, immediately after the `if (search.length === 0)` guard, add:

```ts
if (hasEllipsisToken(search)) {
  return applyReplaceEllipsis(source, search, replace);
}
```

And add the stub at the bottom of the file:

```ts
function applyReplaceEllipsis(
  _source: string,
  _search: string,
  _replace: string,
): ApplyEditResult {
  return { ok: false, reason: "no-match", matchCount: 0 };
}
```

- [ ] **Step 4: Run tests, confirm regression still green**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits`
Expected: all existing tests still pass (no SEARCH in them ends or starts with `...`).

- [ ] **Step 5: Commit**

```bash
git add call-ai/v2/apply-edits.ts call-ai/v2/apply-edits.test.ts
git commit -m "feat(apply-edits): scaffold ellipsis matchKind and dispatch"
```

---

### Task 2: Single-line and multi-line prefix matching

**Files:**
- Modify: `call-ai/v2/apply-edits.ts`
- Modify: `call-ai/v2/apply-edits.test.ts`

Goal: implement the line-pattern matcher for SEARCHes that contain prefix lines (ends with `...`) but no skip lines. Each search line maps 1:1 to a source line; anchors compare equality (with rstrip), prefix lines use `startsWith`.

- [ ] **Step 1: Write the failing test for single-line prefix**

Add to `apply-edits.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits -t "trailing ... prefix"`
Expected: FAIL — stub returns `no-match`.

- [ ] **Step 3: Implement the line-pattern matcher (no skips yet)**

In `apply-edits.ts`, add helpers above `applyReplaceEllipsis`:

```ts
interface LineSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function lineSpans(source: string): readonly LineSpan[] {
  const spans: LineSpan[] = [];
  let i = 0;
  while (i <= source.length) {
    const nl = source.indexOf("\n", i);
    const end = nl === -1 ? source.length : nl;
    spans.push({ start: i, end, text: source.slice(i, end) });
    if (nl === -1) break;
    i = nl + 1;
  }
  return spans;
}

function lineMatches(searchLine: ClassifiedLine, sourceText: string): boolean {
  if (searchLine.kind === "anchor") {
    const a = searchLine.text.replace(/[ \t]+$/, "");
    const b = sourceText.replace(/[ \t]+$/, "");
    return a === b;
  }
  if (searchLine.kind === "prefix") {
    return sourceText.startsWith(searchLine.prefix);
  }
  return false;
}

function findSegmentMatches(
  segment: readonly ClassifiedLine[],
  sourceLines: readonly LineSpan[],
  startFrom: number,
): readonly number[] {
  const hits: number[] = [];
  if (segment.length === 0) return hits;
  for (let i = startFrom; i + segment.length <= sourceLines.length; i++) {
    let ok = true;
    for (let j = 0; j < segment.length; j++) {
      if (!lineMatches(segment[j], sourceLines[i + j].text)) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(i);
  }
  return hits;
}
```

Replace the stub `applyReplaceEllipsis` with the no-skip implementation:

```ts
function applyReplaceEllipsis(
  source: string,
  search: string,
  replace: string,
): ApplyEditResult {
  const searchLines = search.split("\n").map(classifyLine);
  const sourceLines = lineSpans(source);

  // No skips yet: treat the entire search as one segment.
  if (searchLines.every((l) => l.kind !== "skip")) {
    const hits = findSegmentMatches(searchLines, sourceLines, 0);
    if (hits.length === 0) return { ok: false, reason: "no-match", matchCount: 0 };
    if (hits.length > 1)
      return { ok: false, reason: "multiple-match", matchCount: hits.length };
    const start = sourceLines[hits[0]].start;
    const lastIdx = hits[0] + searchLines.length - 1;
    const end = sourceLines[lastIdx].end;
    return {
      ok: true,
      matchKind: "ellipsis",
      content: source.slice(0, start) + replace + source.slice(end),
    };
  }

  // Skips not implemented yet — fall through to no-match.
  return { ok: false, reason: "no-match", matchCount: 0 };
}
```

- [ ] **Step 4: Run test, confirm it passes**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits -t "trailing ... prefix"`
Expected: PASS.

- [ ] **Step 5: Add multi-line prefix + anchor test**

```ts
it("matches a block with a prefix line among anchors", () => {
  const source = [
    "function FeatureOne() {",
    '  return <div className="rounded-lg bg-blue-500 p-4 shadow">',
    "    Hello",
    "  </div>;",
    "}",
  ].join("\n");
  const search = [
    "function FeatureOne() {",
    '  return <div className="rounded...',
    "    Hello",
    "  </div>;",
    "}",
  ].join("\n");
  const replace = "function FeatureOne() {\n  return <div>NEW</div>;\n}";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.matchKind).toBe("ellipsis");
    expect(r.content).toBe(replace);
  }
});
```

- [ ] **Step 6: Add multiple-match prefix test**

```ts
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
```

- [ ] **Step 7: Run all apply-edits tests**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add call-ai/v2/apply-edits.ts call-ai/v2/apply-edits.test.ts
git commit -m "feat(apply-edits): support trailing ... prefix line matches"
```

---

### Task 3: Skip lines (zero-or-more) with segment enumeration

**Files:**
- Modify: `call-ai/v2/apply-edits.ts`
- Modify: `call-ai/v2/apply-edits.test.ts`

Goal: handle `...` at the start of a line as a zero-or-more skip. Split SEARCH into segments separated by skip lines, enumerate all valid `(start_1, …, start_n)` tuples, and require exactly one. Middle skips' consumed lines are part of the replaced range.

- [ ] **Step 1: Write a failing test — skip between two anchors**

```ts
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
```

- [ ] **Step 2: Run test, confirm it fails**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits -t "skip line consuming"`
Expected: FAIL — current implementation falls through to `no-match` for skips.

- [ ] **Step 3: Implement segment splitting and enumeration**

In `apply-edits.ts`, add above `applyReplaceEllipsis`:

```ts
interface Segment {
  readonly lines: readonly ClassifiedLine[];
}

function splitIntoSegments(searchLines: readonly ClassifiedLine[]): {
  segments: readonly Segment[];
  leadingSkip: boolean;
  trailingSkip: boolean;
} {
  const segments: Segment[] = [];
  let buf: ClassifiedLine[] = [];
  let leadingSkip = false;
  let trailingSkip = false;
  let sawAnyNonSkip = false;
  searchLines.forEach((l, idx) => {
    if (l.kind === "skip") {
      if (!sawAnyNonSkip && segments.length === 0 && buf.length === 0) leadingSkip = true;
      if (buf.length > 0) {
        segments.push({ lines: buf });
        buf = [];
      }
      if (idx === searchLines.length - 1) trailingSkip = true;
    } else {
      sawAnyNonSkip = true;
      buf.push(l);
    }
  });
  if (buf.length > 0) segments.push({ lines: buf });
  return { segments, leadingSkip, trailingSkip };
}

interface MatchTuple {
  readonly starts: readonly number[]; // segment start line indexes
}

function enumerateTuples(
  segments: readonly Segment[],
  sourceLines: readonly LineSpan[],
): readonly MatchTuple[] {
  const tuples: MatchTuple[] = [];
  if (segments.length === 0) return tuples;
  const recurse = (segIdx: number, fromLine: number, acc: number[]): void => {
    if (segIdx === segments.length) {
      tuples.push({ starts: [...acc] });
      return;
    }
    const seg = segments[segIdx];
    const hits = findSegmentMatches(seg.lines, sourceLines, fromLine);
    for (const h of hits) {
      acc.push(h);
      recurse(segIdx + 1, h + seg.lines.length, acc);
      acc.pop();
    }
  };
  recurse(0, 0, []);
  return tuples;
}
```

Replace the body of `applyReplaceEllipsis`:

```ts
function applyReplaceEllipsis(
  source: string,
  search: string,
  replace: string,
): ApplyEditResult {
  const searchLines = search.split("\n").map(classifyLine);
  const sourceLines = lineSpans(source);
  const { segments, leadingSkip, trailingSkip } = splitIntoSegments(searchLines);

  if (segments.length === 0) {
    return { ok: false, reason: "no-match", matchCount: 0 };
  }

  const tuples = enumerateTuples(segments, sourceLines);
  if (tuples.length === 0) return { ok: false, reason: "no-match", matchCount: 0 };
  if (tuples.length > 1)
    return { ok: false, reason: "multiple-match", matchCount: tuples.length };

  const t = tuples[0];
  const firstSegStart = t.starts[0];
  const lastSegStart = t.starts[t.starts.length - 1];
  const lastSegLen = segments[segments.length - 1].lines.length;

  const startLine = leadingSkip ? 0 : firstSegStart;
  const endLine = trailingSkip ? sourceLines.length - 1 : lastSegStart + lastSegLen - 1;
  const startChar = sourceLines[startLine].start;
  const endChar = sourceLines[endLine].end;

  return {
    ok: true,
    matchKind: "ellipsis",
    content: source.slice(0, startChar) + replace + source.slice(endChar),
  };
}
```

- [ ] **Step 4: Run the new test, confirm it passes**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits -t "skip line consuming"`
Expected: PASS.

- [ ] **Step 5: Add skip = 0 test**

```ts
it("accepts skip = 0 between adjacent anchors", () => {
  const source = "open\nclose";
  const search = "open\n...\nclose";
  const replace = "DONE";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe("DONE");
});
```

- [ ] **Step 6: Add ambiguous skip test**

```ts
it("rejects ambiguous skip lengths as multiple-match", () => {
  const source = "foo\nx\nbar\ny\nbar";
  const search = "foo\n...\nbar";
  const r = applyReplace({ source, search, replace: "Z" });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe("multiple-match");
});
```

- [ ] **Step 7: Add adjacent-skip-collapse test**

```ts
it("collapses adjacent skip lines", () => {
  const source = "foo\na\nb\nc\nbar";
  const search = "foo\n...\n...\nbar";
  const replace = "BAZ";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe("BAZ");
});
```

(Adjacent skip lines collapse naturally because `splitIntoSegments` only flushes the segment buffer when it has anchors/prefixes — multiple consecutive skips just leave the buffer empty.)

- [ ] **Step 8: Add skip-with-comment test**

```ts
it("ignores trailing comment text after leading ...", () => {
  const source = "function foo() {\n  body;\n}";
  const search = "function foo() {\n  ...rest of body\n}";
  const replace = "function foo() {}";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe(replace);
});
```

- [ ] **Step 9: Add middle-skip-consumes-content test**

```ts
it("middle skip consumes intervening lines into the replaced range", () => {
  const source = "foo\nx\ny\nbar";
  const search = "foo\n...\nbar";
  const replace = "qux";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe("qux");
});
```

- [ ] **Step 10: Run all apply-edits tests**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add call-ai/v2/apply-edits.ts call-ai/v2/apply-edits.test.ts
git commit -m "feat(apply-edits): support multi-line skip with leading ..."
```

---

### Task 4: Anchor edge cases (mid-line `...` literal, REPLACE literal)

**Files:**
- Modify: `call-ai/v2/apply-edits.test.ts`

Goal: lock in two correctness properties that follow from the design but deserve explicit tests: `...` in the middle of a SEARCH line is literal (anchor match), and `...` in REPLACE is literal text.

- [ ] **Step 1: Write the failing test for mid-line `...` literal**

```ts
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
```

- [ ] **Step 2: Run tests**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits -t "middle of a SEARCH line"`
Expected: PASS for both — `classifyLine` only treats `...` at start or end as a token, so mid-line `...` falls into the anchor branch and goes through the existing exact path.

- [ ] **Step 3: Add `...` in REPLACE is literal test**

```ts
it("passes ... in REPLACE through verbatim", () => {
  const source = "before\nplaceholder\nafter";
  const search = "placeholder";
  const replace = "now ... done";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe("before\nnow ... done\nafter");
});

it("passes ... in REPLACE through verbatim even when SEARCH uses ellipsis", () => {
  const source = 'foo\n  <div className="long tail">\nbar';
  const search = '  <div className="long...';
  const replace = "  ...kept literal";
  const r = applyReplace({ source, search, replace });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.content).toBe("foo\n  ...kept literal\nbar");
});
```

- [ ] **Step 4: Run all apply-edits tests**

Run: `cd call-ai/v2 && pnpm vitest run apply-edits`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add call-ai/v2/apply-edits.test.ts
git commit -m "test(apply-edits): pin literal semantics for mid-line and REPLACE ..."
```

---

### Task 5: Prompt addendum

**Files:**
- Modify: `prompts/pkg/system-prompt.md`

Goal: teach the model the two shortcuts in one short paragraph + one example, placed near the existing SEARCH/REPLACE section.

- [ ] **Step 1: Read the current system-prompt.md region around SEARCH/REPLACE**

Run: `cd /Users/jchris/code/fp/vibes.diy && grep -n "SEARCH/REPLACE\|<<<<<<< SEARCH\|>>>>>>> REPLACE" prompts/pkg/system-prompt.md`

Identify a location after the existing rule "If a single SEARCH/REPLACE grows beyond ~25 lines, split it." (line ~61 in the spec exploration earlier). The addendum belongs in that same rules region.

- [ ] **Step 2: Insert the addendum**

After the existing line containing `If a single SEARCH/REPLACE grows beyond ~25 lines, split it.`, insert these new paragraphs (preserve a blank line before and after):

```markdown
**Two `...` shortcuts on the SEARCH side keep edits compact:**

- A line ending in `...` is a single-line **prefix match** — the source line must begin with what's before the `...`; the rest is ignored. Use this to skip long Tailwind class strings or other noisy line tails.
- A line starting with `...` is a **multi-line skip** — it matches zero or more source lines of any content. Any text after the leading `...` is just a comment for clarity (e.g. `...rest of body`). The skipped lines are part of the replaced range.
- A `...` in the middle of a line is literal text and participates in exact match. The REPLACE side never has special meaning for `...` — write the new content verbatim.

Example — replacing a function with a fat Tailwind line without retyping the classes:

```jsx
<<<<<<< SEARCH
function CardHeader() {
  return <h2 className="text-2xl font-bold...
}
=======
function CardHeader() {
  return <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>;
}
>>>>>>> REPLACE
```

The matcher still requires exactly one match in the file; if the `...` shortcuts make the SEARCH ambiguous, add a surrounding anchor line to disambiguate.
```

- [ ] **Step 3: Verify the prompt-tests still pass**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm --filter prompts test 2>&1 | tail -30`
Expected: pass. (If the test snapshots the full prompt, update the snapshot — that's the only acceptable snapshot update from this change.)

- [ ] **Step 4: Run the full check**

Run: `cd /Users/jchris/code/fp/vibes.diy && pnpm check`
Expected: format / build / test / lint all green. Per [agents/flaky-tests.md](../../../agents/flaky-tests.md), if a `pnpm check` failure looks unrelated, rerun once before treating it as real.

- [ ] **Step 5: Commit**

```bash
git add prompts/pkg/system-prompt.md prompts/tests
git commit -m "docs(prompt): teach SEARCH/REPLACE ... prefix and skip shortcuts"
```

---

## Self-Review Checklist (run after writing this plan)

- **Spec coverage:**
  - Anchor / prefix / skip line types → Tasks 1–3.
  - Mid-line `...` literal → Task 4.
  - REPLACE literal → Task 4.
  - Exactly-one-match correctness via tuple enumeration → Task 3.
  - Middle skip consumes content into replaced range → Task 3 step 9.
  - Leading/trailing skip extends to file boundary → enabled in Task 3 implementation; not separately tested (low value, easy to verify by inspection of `applyReplaceEllipsis`).
  - Adjacent skip collapse → Task 3 step 7.
  - `...` skip ignored comment text → Task 3 step 8.
  - Prompt addendum → Task 5.
- **Placeholder scan:** none.
- **Type consistency:** `classifyLine`, `lineSpans`, `findSegmentMatches`, `splitIntoSegments`, `enumerateTuples`, `applyReplaceEllipsis` — names and shapes are consistent across tasks. The matchKind union add lands in Task 1 and is used in Tasks 2–3 emissions.
