# `@vibes.diy/eval-codegen-edit`

Eval harness that drives the CLI's generation flow against a curated prompt
corpus, archives every section event, and surfaces the runs where the
SEARCH/REPLACE parser failed to apply edits cleanly. Used as a corpus to
harden `@vibes.diy/call-ai-v2`'s `parseFenceBody` / `applyEdits` and the
prompt template that teaches the model how to format edit blocks.

See [PLAN.md](./PLAN.md) for the design rationale. This README is a
quick-start for future agents working on this package.

## Prerequisites

- Logged-in `vibes-diy` CLI (`vibes-diy login`). The harness reuses the same
  device-id keybag — no separate auth.
- Account has access to the `eval` user slug (default; override via
  `--user-slug`).

## Run a single prompt

```sh
cd eval/codegen-edit
node_modules/.bin/tsx src/run.ts task-tracker
# or any id from prompts/seed.jsonl: kanban-priority, recipe-book, …
```

Each run writes one directory under `archive/<timestamp>_<promptId>/` and
appends a one-line summary to `archive/index.jsonl`.

CLI flags:

- `<promptId>` — positional, matches the `id` field in `prompts/seed.jsonl`.
  Defaults to the first entry.
- `--user-slug <slug>` — defaults to `eval`.
- `--api-url <url>` — defaults to prod (`https://vibes.diy/api`).
- `--archive-root <path>` — defaults to `./archive`.
- `--prompts <path>` — defaults to `./prompts/seed.jsonl`.

The harness today drives only the `create` field of each corpus entry — a
single LLM turn that mirrors the current `cli generate` flow. The `edits[]`
arrays are wired into the data shape but unused; they will activate once the
CLI lands an `edit` command (VibesDIY/vibes.diy#1549) and the multi-turn
SDK shape is validated.

## Archive layout

```
archive/
  index.jsonl                     # one line per run; primary stats source
  <timestamp>_<promptId>/
    manifest.json                 # prompt, slugs, exit state, per-turn summary
    sections.jsonl                # every SectionEvent + ResError, in order — load-bearing
    prompt-events.jsonl           # per-turn promptId + start time
    resolved/                     # final files written by createFileSystemStream
      App.jsx
      …
    errors.json                   # FsApplyErrorMsg[] (parse + apply failures)
    upstream-errors.json          # ResError[] from the chat stream
```

`sections.jsonl` is the **load-bearing artifact** — every other file is
derived. To reproduce `errors.json` and `resolved/` from a fresh parser
build, replay `sections.jsonl` through `createFileSystemStream` (replay tool
not yet shipped).

## Reading archives — verified one-liners

All examples run from `eval/codegen-edit/`. Output is from a real archive
unless noted. Replace the path with whatever you want to inspect.

### Aggregate stats across all runs

```sh
cat archive/index.jsonl | jq -s '
  { total: length,
    ok: map(select(.exitState=="ok")) | length,
    withApplyErrors: map(select(.applyErrors>0)) | length,
    withUpstreamErrors: map(select(.upstreamErrors>0)) | length,
    totalApplyErrors: map(.applyErrors // 0) | add,
    totalUpstreamErrors: map(.upstreamErrors // 0) | add }'
```

### One-line per-run summary

```sh
cat archive/index.jsonl | jq -r '
  "\(.promptId)\t\(.exitState)\tapply=\(.applyErrors // 0)\tupstream=\(.upstreamErrors // 0)\tfiles=\(.resolvedFiles // "?")\t\(.archive)"'
```

### Failure breakdown for one archive

```sh
jq -r '.[] | .path as $p | .failures[] |
  "\($p)\t\(.reason)\t\(.parseErrorKind // "")\t\(.search // "" | .[0:60])"' \
  archive/2026-05-04T17-37-55-321Z_task-tracker/errors.json
```

Real output from this archive:

```
App.jsx	parse-error	orphan-divider
App.jsx	parse-error	unterminated-replace
App.jsx	no-match		  mono: "font-['JetBrains_Mono',monospace]",
```

(The `no-match` failure shows the SEARCH text the parser couldn't find in the
current file state — first 60 chars.)

### Block-type histogram for one stream

Useful to confirm a run is well-formed and to count code sections vs.
top-level blocks.

```sh
jq -s '[.[] | .msg.blocks // [] | .[] | .type] |
  group_by(.) | map({type: .[0], count: length})' \
  archive/2026-05-04T17-37-55-321Z_task-tracker/sections.jsonl
```

Real output (excerpt):

```
[ { "type": "block.code.begin",  "count": 6   },
  { "type": "block.code.end",    "count": 6   },
  { "type": "block.code.line",   "count": 297 },
  { "type": "block.end",         "count": 1   },
  …
]
```

### Reconstruct the raw model output for the failing section

`errors.json` reports a `sectionId` for each failure. To see exactly what
the model emitted, filter `sections.jsonl` to that section's `code.line`
events:

```sh
jq -r 'select(.msg.blocks // [] | any(.type=="block.code.line")) |
  .msg.blocks[] |
  select(.type=="block.code.line" and .sectionId=="z3yQpehJSzBRV6vFmF") |
  .line' \
  archive/2026-05-04T17-37-55-321Z_task-tracker/sections.jsonl
```

This is the minimum repro to lift into a parser unit test —
`parseFenceBody(linesArray)` should produce the same `parseErrorKind` you saw
in `errors.json`.

### List all `block.code.begin` paths (which file each section targeted)

```sh
jq -r 'select(.msg.blocks // [] | any(.type=="block.code.begin")) |
  .msg.blocks[] |
  select(.type=="block.code.begin") |
  "\(.sectionId)\t\(.path)"' \
  archive/<archive-dir>/sections.jsonl
```

## Adding to the corpus

`prompts/seed.jsonl` is JSON-Lines. Each entry:

```json
{ "id": "task-tracker", "create": "Build a task tracker. …", "edits": ["Add status field …", "Add a tag cloud …"] }
```

Today only `create` is consumed. Keep entries:

- **callAI + Fireproof.** Avoid ImgVibes / image-gen prompts — they bias
  toward single-create flows where the parser doesn't hurt.
- **Rich enough to require multiple files / structured state.** A single
  one-shot create that fits in a few hundred lines is the floor; below that
  the model rarely emits SEARCH/REPLACE blocks.
- **Edit-friendly.** Even though `edits[]` isn't driven yet, design entries
  so the follow-up edits will plausibly produce SEARCH/REPLACE traffic
  against the create output. That's where the parser fails.

## What we know breaks today

From the first smoke runs (n=2 same prompt):

- `orphan-divider` — model emits a `=======` line outside an open SEARCH
  block. Often co-occurs with:
- `unterminated-replace` — the parser was inside a REPLACE section when the
  fence closed, with no `>>>>>>> REPLACE` marker.
- `no-match` — model writes a SEARCH block whose text doesn't appear in the
  current file state. Often when the model imagines content from an earlier
  draft of its own response, or copies a snippet that drifted by whitespace.

The first two are parser problems (or prompt problems — teaching the model
the format more strictly). The third is a model problem that the prompt
might mitigate. Lifting any of these into a `@vibes.diy/call-ai-v2` test is
the right next step when iterating.

## What's NOT in the harness yet

- `batch.ts` — drive all 20 corpus entries in one go
- `replay.ts` — feed `sections.jsonl` back through a (potentially modified)
  `createFileSystemStream` to compare error counts before/after a parser
  change
- `analyze.ts` — failure clustering across the full archive
- Multi-turn (`edits[]` field) — gated on the CLI `edit` command
  (VibesDIY/vibes.diy#1549)
- CI integration — see PLAN.md "Out of scope (for v1)"

The single-run path is enough to start producing corpus material; the rest
will be added once we know what we want to measure.
