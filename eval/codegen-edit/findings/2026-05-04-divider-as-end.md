# Parser fix: `=======` as accidental REPLACE closer

## Failure observed

Two of seven harness runs (29%) hit the same parser failure
(archives at `eval/codegen-edit/archive/2026-05-04T17-37-55-321Z_task-tracker/`
and `eval/codegen-edit/archive/2026-05-04T18-30-21-717Z_bookmarks/`).
In both cases the model emitted a SEARCH/REPLACE block that closes with a
second `=======` divider instead of `>>>>>>> REPLACE`:

```
<<<<<<< SEARCH
const classNames = { … };
=======
const classNames = { … big new value … };
=======                          ← should be `>>>>>>> REPLACE`
[EOF]
```

`parseFenceBody` ([call-ai/v2/fence-body-parser.ts](../../../call-ai/v2/fence-body-parser.ts))
sees the second divider while `mode === "in-replace"`, falls into the
"orphan-divider" branch on line 56, and then at end-of-input the still-open
mode triggers "unterminated-replace" on line 98. Two errors, no edit
emitted, REPLACE content discarded — `App.jsx` ends up with the SEARCH text
unmodified.

The prompt template ([prompts/pkg/system-prompt.md](../../../prompts/pkg/system-prompt.md))
already documents the correct format; the model is just getting it wrong
some of the time. The eval harness's job is to surface failures like this
and the parser should recover where it can.

## Rules-bag check (before coding)

- **Test first** (rule 16) — the unit test goes in
  `call-ai/v2/fence-body-parser.test.ts`, written from the raw section
  reconstructed via the README's jq recipe. Run it RED first to confirm
  the repro.
- **No throws** (rule 20) — parser already returns a structured
  `ParsedFenceBody`. Don't change that contract.
- **No mocks** (rule 14) — pure parser unit test, no mocks needed.
- **Result/Option** — N/A here, parser is sync and structural.
- **Avoid casts** (rule 10) — none expected.
- **`<= 3 params`, typed objects** (rule 68) — `parseFenceBody(lines)` is
  one param.

## Plan

### Step 1 — Lift the repro into a unit test (RED)

From the harness archive, the failing section's raw lines are at
`/tmp/section_z3yQpehJSzBRV6vFmF.txt` (task-tracker) and
`/tmp/section_zSVTN5NUJTCzwDJr3.txt` (bookmarks). They differ only in
content — the structural pattern is identical:

1. `<<<<<<< SEARCH`
2. _(some lines)_
3. `=======`
4. _(some lines)_
5. `=======`
6. _(EOF)_

Add to [fence-body-parser.test.ts](../../../call-ai/v2/fence-body-parser.test.ts)
a test that builds this minimal structure with a 1-line search and a 1-line
replace and asserts:

- After the fix: `edits.length === 1`, the single edit is a `replace` with
  the expected search/replace strings, and `errors` either contains a
  single soft warning (e.g. `divider-as-end`) or is empty depending on the
  decision in step 3.
- The test name and shape should match the existing
  `fence-body-parser.test.ts` style (`describe`/`it`, `expect.toEqual`).

The test should fail against the current parser with two errors and zero
edits — the RED bar.

### Step 2 — Recovery semantics: divider always ends the section

Unified transition rule, no lookahead: **a divider in `in-replace` always
ends the replace and emits the edit**, with a soft `divider-as-end`
warning so the harness can count how often this fallback fires.

```
in-search   + ======= → in-replace
in-replace  + ======= → emit edit, mode = between (+ divider-as-end warning)
plain/between + ======= → orphan-divider error (unchanged)
```

The risk is bare `=======` (exactly 7, no prefix, nothing else on the
line) appearing inside REPLACE content. The DIVIDER regex is
`/^={7}\s*$/` — strict. In a JSX/TS vibe app this never legitimately
occurs, and the system prompt explicitly defines `=======` as a marker
so the model has no incentive to emit a literal one inside content.

This rule scope: only the divider transition. The model dropping
`>>>>>>> REPLACE` between two stacked edits is a different shape (the
follow-up `<<<<<<< SEARCH` while we're still `in-replace`) — not
covered by this PR. If we see that pattern in the corpus we'll add
matching SEARCH-while-in-replace recovery in a follow-up.

### Step 3 — Implement

In `parseFenceBody`, change the `DIVIDER` branch:

```ts
if (DIVIDER.test(trimmed)) {
  if (mode === "in-search") {
    mode = "in-replace";
    continue;
  }
  if (mode === "in-replace") {
    // Lenient recovery: model used `=======` as the closer instead of
    // `>>>>>>> REPLACE`, or omitted the closer between stacked edits.
    edits.push({
      op: "replace",
      search: searchLines.join("\n"),
      replace: replaceLines.join("\n"),
    });
    searchLines = [];
    replaceLines = [];
    mode = "between";
    errors.push({ kind: "divider-as-end", lineNr });
    continue;
  }
  errors.push({ kind: "orphan-divider", lineNr });
  continue;
}
```

Add `"divider-as-end"` to `FenceParseErrorKind` so consumers can
distinguish soft recovery from hard parse failure.

### Step 4 — Verify against existing tests

- `pnpm -F @vibes.diy/call-ai-v2 test` — all existing fence-body-parser
  tests must stay green. The orphan-divider midstream test
  (line 112 in test file) is the load-bearing existing case to preserve.
- Run the new RED test — it should now be GREEN.

### Step 5 — Replay against the harness archive

The eval harness's archives contain `sections.jsonl` for the two failing
runs. Until `replay.ts` ships, do a one-off replay: write a short tsx
script that reads `sections.jsonl`, feeds the blocks back through
`createFileSystemStream`, and reports the new error count. The expectation:

- task-tracker `errors.json`: was `[orphan-divider, unterminated-replace,
no-match]` (3 entries) → should become `[divider-as-end, no-match]`
  (2 entries; the no-match is unrelated).
- bookmarks `errors.json`: was `[orphan-divider, unterminated-replace]`
  (2 entries) → should become `[divider-as-end]` (1 soft warning).

If those numbers match, the fix lands the recurring pattern.

### Step 6 — Re-run a fresh corpus run and confirm

Run the harness against `task-tracker` and `bookmarks` 2-3 times each. The
divider-as-end pattern is stochastic (the model doesn't always emit it),
but if the fix is correct, runs that _would have_ failed with the old
parser should now succeed with at most a soft `divider-as-end` warning.

### Step 7 — Optional: prompt-side reinforcement

If after the parser fix we still see this pattern frequently across the
broader corpus, add a one-line emphasis to
[prompts/pkg/system-prompt.md](../../../prompts/pkg/system-prompt.md)
near the existing SEARCH/REPLACE example: _"End every REPLACE block with
`>>>>>>> REPLACE` — never with another `=======`."_ This is belt-and-
suspenders; defer until we have data showing the parser fix isn't enough.

### Step 8 — PR

Title: `fix(call-ai-v2): recover from REPLACE blocks closed with =======`

Body: link the harness archives that motivated the fix, summarize the
recovery semantics, attach the before/after replay numbers from step 5.

## Out of scope for this PR

- The unrelated `no-match` error in the task-tracker archive (model tried
  to replace a `mono: "..."` font line that wasn't in the file). That's a
  different failure mode — content-imagining — that the parser can't fix.
- Multi-turn drive (still gated on VibesDIY/vibes.diy#1549).
- Replay tool (`replay.ts`) — step 5 uses a one-off script.

## Done criteria

- New RED test added; passes after the parser change.
- All existing `fence-body-parser.test.ts` cases green.
- One-off replay confirms both archived failures resolve to either zero
  hard errors or one soft `divider-as-end`.
- PR opened, CI green.
