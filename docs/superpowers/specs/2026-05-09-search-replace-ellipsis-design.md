# SEARCH/REPLACE ellipsis shortcuts

Date: 2026-05-09
Status: Design approved, plan pending

## Motivation

The SEARCH/REPLACE format used by Vibes' code edits requires the SEARCH side
to match the source verbatim. For lines with long, structurally-irrelevant
content — typically Tailwind class strings — this forces the model to
reproduce dozens of tokens it doesn't actually want to change, inflating
prompt size and creating fragile matches that fail when any byte drifts.

This design adds two opt-in shortcuts that let SEARCH express intent more
loosely without sacrificing the matcher's "exactly one match or error"
correctness property.

## Grammar

A SEARCH block consists of lines, each classified by its relationship to the
literal three-dot token `...`:

1. **Anchor line** — no `...` involvement. Matches a single source line
   exactly (with the existing per-line trailing-whitespace tolerance).
2. **Prefix line** — ends with `...` and does not start with `...`.
   Matches one source line where `sourceLine.startsWith(prefix)`, where
   `prefix` is everything before the trailing `...` (indentation included).
   The remainder of the source line is consumed by the match.
3. **Skip line** — starts with `...`. Matches zero or more source lines of
   any content. Any text after the leading `...` is a comment for the model
   (e.g. `...rest of function body`) and is ignored by the matcher.
4. **`...` in the middle of a line** — not a token. The line is an anchor;
   the literal `...` participates in exact match. (Tested explicitly.)

A bare `...` line is a skip line (zero-or-more). There is no distinct
"exactly one line" wildcard form: the model can pin structure with a real
anchor following the skip when it needs to.

REPLACE is unchanged. `...` on the REPLACE side has no special meaning;
it is literal text.

## Correctness: exactly one match

The current 0/1/many match model is the load-bearing safety property and is
preserved. Matching proceeds as follows:

- Split SEARCH into a list of segments separated by skip lines, e.g.
  `[seg₁, SKIP, seg₂, SKIP, seg₃]`. Each segment is a contiguous run of
  anchor and prefix lines.
- Each segment matches against source lines via the v1 sliding-window
  line-by-line matcher: anchor lines compare for equality (with trailing-ws
  tolerance), prefix lines use `startsWith`.
- Enumerate **all** tuples `(start_1, …, start_n)` such that each
  `seg_i` matches starting at line `start_i`, with `start_{i+1} ≥ start_i +
  len(seg_i)` (skip length ≥ 0).
- Require exactly one tuple across the whole source.
  - 0 tuples → `no-match`
  - >1 tuples → `multiple-match`
  - 1 tuple → success; replace the source character range from the start of
    `seg_1`'s first line through the end of `seg_n`'s last line with the
    REPLACE string. **The lines consumed by middle skips are inside this
    range and are removed**; the REPLACE content stands in for the entire
    span including those skipped lines (which is the point — `function Foo
    / ... / }` replaces the whole function body).

This guarantees that any SEARCH whose ellipses introduce structural
ambiguity is rejected rather than silently picking a guess.

### Leading and trailing skips

A leading skip (SEARCH starts with `...`) extends the matched range
**back to the start of the file**; a trailing skip extends it to the end
of the file. This is the consistent reading of "skip consumes lines into
the match range," but in practice means leading/trailing skips replace
prelude/postlude content. Almost always the model wants ordinary internal
anchors instead. We allow leading/trailing skips for grammar simplicity
and rely on the "exactly one match" rule plus model judgment; no special
error.

### Worked ambiguity example

SEARCH:

```
foo
...
bar
```

Source:

```
foo
x
bar
y
bar
```

Two valid tuples exist (skip = `[x]` ending at the first `bar`, or skip =
`[x, bar, y]` ending at the second `bar`). Result: `multiple-match`.

## Edge cases

- Two adjacent skip lines collapse to one before matching.
- A SEARCH consisting only of skip lines is invalid → `no-match`.
- Leading or trailing skip lines are allowed; the "exactly one tuple" rule
  handles ambiguity.
- A literal `...`-terminated source line (rare) may produce a false-positive
  prefix match. Accepted; no escape mechanism. The "exactly one" rule still
  prevents catastrophic misapplication in any non-trivial source.

## Implementation

All changes are scoped to one module:

- [call-ai/v2/apply-edits.ts](../../../call-ai/v2/apply-edits.ts) — the
  matcher.
- [call-ai/v2/apply-edits.test.ts](../../../call-ai/v2/apply-edits.test.ts)
  — tests.

Plus a small prompt addendum in
[prompts/pkg/system-prompt.md](../../../prompts/pkg/system-prompt.md).

### Matcher changes

`applyReplace` keeps its current fast path bit-identical when SEARCH
contains no ellipsis tokens. When any line is a prefix or skip line, it
falls into the new line-pattern matcher described above.

The result type gains a new `matchKind` value:

```ts
matchKind: "exact" | "trailing-ws" | "ellipsis"
```

The error reasons (`no-match`, `multiple-match`) are unchanged.

No change is needed in
[vibes.diy/pkg/app/components/ResultPreview/CodeEditor.tsx](../../../vibes.diy/pkg/app/components/ResultPreview/CodeEditor.tsx);
it consumes `applyReplace` and is agnostic to match kind.

### Prompt addendum

A short paragraph near the existing SEARCH/REPLACE rules in
[prompts/pkg/system-prompt.md](../../../prompts/pkg/system-prompt.md):

- `...` at the **end** of a SEARCH line is a single-line prefix match
  (useful for skipping long Tailwind tails).
- `...` at the **start** of a SEARCH line is a multi-line skip (zero or
  more lines); any text after the `...` is a comment for clarity, e.g.
  `...rest of function body`.
- `...` in the middle of a line is literal.
- REPLACE is always literal text.

One short example showing a tailwind line with a trailing-`...` prefix
match.

## Tests

Add to
[call-ai/v2/apply-edits.test.ts](../../../call-ai/v2/apply-edits.test.ts):

1. **Prefix match, single line** — `<div className="foo...` matches a
   longer source line; replacement substitutes the full source line.
2. **Mixed anchor + prefix** — multi-line SEARCH with anchors plus one
   prefix line on the messy tailwind line.
3. **Skip between anchors** — `foo / ... / bar` matches with one
   intervening line.
4. **Skip = 0** — same SEARCH, anchors adjacent in source: accepted.
5. **Ambiguous skip length** — the worked example above → `multiple-match`.
6. **Skip with comment text** — `...rest of body` ignored by matcher.
7. **Skip + prefix line combined** in one SEARCH.
8. **Mid-line `...` is literal** — `foo ... bar` is an anchor line and
   matches the source only when the source contains the exact sequence
   `foo ... bar`. (Explicitly requested.)
9. **`...` in REPLACE is literal** — passes through verbatim.
10. **Regression** — a SEARCH with no ellipsis tokens produces a result
    bit-identical to the v1 implementation (including `matchKind: "exact"`
    or `"trailing-ws"`).
11. **Middle skip consumes replaced lines** — `foo / ... / bar` against
    `foo / x / y / bar` plus REPLACE `qux` produces source `qux` (the
    `x / y` content is gone).

## Out of scope

- Escape mechanism for literal `...` at the end or start of a line.
- `...` semantics in REPLACE (preserve consumed suffix, etc.).
- Changes to the recovery / streaming code paths beyond what `applyReplace`
  produces.
