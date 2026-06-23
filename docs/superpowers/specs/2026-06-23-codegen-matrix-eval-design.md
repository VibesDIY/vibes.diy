# `eval/codegen-matrix` — cross-model codegen eval harness

## Goal

A repeatable harness that runs a fixed set of prompts across a configurable set
of models and scores each `(model × prompt)` cell on three factors: **speed**,
**adherence** (to the codegen system prompt), and **design quality**.

The defining constraint: **adding a future model is a one-line edit to a JSON
config — no code change.** The harness is meant to be re-run as new models land
on the platform.

Cost is deliberately _not_ a factor the harness computes. It is a post-eval
filter the operator applies to the result table (cheapest model that clears an
adherence/design bar). See "Out of scope".

## Why this is a new package, not an extension of `eval/codegen-edit`

`eval/codegen-edit` exists to harden the SEARCH/REPLACE parser: it drives the
generation flow **in-process** (importing `chat.sectionStream`,
`createFileSystemStream`), archives every section event for offline replay, and
deliberately **skips deploy** (`pushFromDir`). Its scope is model→parser.

`codegen-matrix` has a different scope (model→model comparison on observable
output quality) and a different mechanism: it shells out to the **published
CLI's `generate`**, which deploys the app and triggers a server-side
screenshot. Mixing the two would tangle parser-corpus concerns with
model-comparison concerns the original PLAN kept separate. So it lands as a
sibling package, reusing primitives where they fit (the `eval` handle
convention, the `call-ai` direct-call pattern from `preamble-probe`).

## Architecture — four stages, each independently runnable

Each stage reads the previous stage's artifacts off disk, so any stage can be
re-run without repeating the expensive one before it (e.g. re-score without
re-generating).

```
config/  →  generate  →  score  →  report
            (stage 2)    (stage 3) (stage 4)
```

### Stage 1 — Config

Two checked-in files under `eval/codegen-matrix/config/`:

`matrix.json`:

```jsonc
{
  "cliCommand": "npx vibes-diy@latest", // the generate mechanism; pinnable
  "apiUrl": "https://vibes.diy/api?.stable-entry.=cli", // target env; NOT prod-hardcoded
  "runtimeHostBase": "vibes.diy", // deployed vibe host base; preview differs from apiUrl host
  "handle": "eval", // publish namespace
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 3, // runs per cell; report median/mean
  "screenshotTimeoutMs": 120000, // readiness-poll budget
  "models": [
    { "id": "anthropic/claude-opus-4.6-fast", "class": "anthropic", "tier": "expensive" },
    { "id": "anthropic/claude-sonnet-4.6", "class": "anthropic", "tier": "cheap" },
    { "id": "google/gemini-3.1-pro-preview", "class": "google", "tier": "expensive" },
    { "id": "google/gemini-2.5-flash-lite", "class": "google", "tier": "cheap" },
    // …cheapest + priciest per class; add a future model = add a line
  ],
}
```

`apiUrl` is an explicit field, not hardcoded to prod (per Charlie's review).
The intended workflow is to run most iterations against a non-prod env
(cli/preview) and a smaller confirmation set against prod before decisions.
`generate` threads `--api-url` through to the deploy/push path
(`vibes-diy/cli/cmds/generate-cmd.ts`), and the resolved `apiUrl` is persisted
into every output (see "Run provenance") so a run's target env is never
ambiguous after the fact.

`prompts.jsonl` — three entries spanning distinct capability surfaces:

```jsonc
{"id":"collab-lists","prompt":"Multi-list todo app. A list creator sees only their own lists and can invite collaborators per list; invited collaborators see only the lists shared with them. Persist lists, items, and per-list membership in Fireproof."}
{"id":"audio-synth","prompt":"Web Audio synthesizer with a playable keyboard and an ADSR envelope (attack/decay/sustain/release sliders) that shapes each note. No external audio libraries."}
{"id":"recipe-shop","prompt":"Recipe to smart shopping list. Enter a recipe; use callAI with a JSON schema to extract ingredients into structured docs; tapping an item toggles 'have it' with optimistic Fireproof writes and a per-row saving cue; a button uses callAI to suggest substitutions."}
```

Rationale for the three: `collab-lists` is the hardest adherence target (forces
a correct `access.js` channel/grant model); `audio-synth` is deliberately
off-stack (no Fireproof/callAI — tests raw Web Audio + the no-emoji/inline-SVG
design rules); `recipe-shop` stresses the callAI-schema + optimistic-write
rules neither other prompt touches.

### Stage 2 — Create loop (`src/generate.ts`)

The create loop is _only_ calls to the published CLI's `generate`, one per
`model × prompt × rep`. For each cell:

1. Make a per-cell working dir `runs/<ts>/<promptId>__<modelSlug>__r<rep>/`,
   empty before the run.
2. Run `<cliCommand> generate --model <id> --handle <handle> --api-url <apiUrl> "<prompt>"`
   in that dir.
3. Record wall-clock latency (spawn → exit) and exit state.
4. Discover the result from the **filesystem, not stdout.** The CLI's
   `res-generate` envelope is _not_ printed — `main.ts` handles `isResGenerate`
   with a bare `break` ("already reported via sendProgress"), and `--json` does
   not change that, so stdout carries only human progress text. Instead: the
   only subdirectory the CLI creates in the (empty) per-cell cwd is
   `<appSlug>/`, so `appSlug` is that directory name and `<directory>` is its
   path. `ownerHandle` is the `--handle` we passed. The generated `README.md`
   in that directory also carries the live vibe URL as a cross-check.
5. Write `cell.json` with the cell result **and run provenance**:
   `{ promptId, model, class, tier, rep, appSlug, ownerHandle, directory,
latencyMs, exitState, stderrTail, apiUrl, cliVersion, promptHash }`.

`appSlug` and `ownerHandle` are all the design needs — the screenshot URL in
stage 3 is built from them, so no stdout parsing is required.

Runs are **sequential** — parallelizing risks rate-limit errors that pollute
results with infrastructure noise (same rationale as `codegen-edit`).

`generate` deploys to the configured `apiUrl` under the `eval` handle and the
platform captures a screenshot asynchronously; the harness does not render
anything itself.

#### Run provenance

So a result set is interpretable months later (and across env/model churn),
each run writes a `runs/<ts>/run.json` capturing: resolved `apiUrl`,
`cliCommand` + resolved `cliVersion` (`npx vibes-diy@latest` is pinned to the
concrete version that actually ran), the harness git commit SHA, `judgeModel`,
`reps`, and a content hash of `prompts.jsonl`. Each `cell.json` additionally
carries its own `apiUrl`, `cliVersion`, and per-prompt `promptHash` so a single
cell is self-describing even if lifted out of its run dir.

### Stage 3 — Scoring (`src/score.ts`)

Three scorers run over each cell's `cell.json` + generated files:

**Speed** — `latencyMs` from stage 2. Report median across reps. Free; no new
instrumentation.

**Adherence** — two layers, both written to `cell.score.json`:

- _Deterministic rubric_ (`src/rubric.ts`) over the generated files. Each rule
  is a boolean derived statically from the codegen system prompt
  (`prompts/pkg/system-prompt.md`):
  The five rules shipped in `src/rubric.ts` (each with a `promptAnchor`):
  - `export-default-app` — `App.jsx` contains `export default function App(`
  - `es-imports-no-globals` — ES `import` at top; no `window.React` global
  - `no-raw-bracket-colors` — no raw `bg-[#…]`/`text-[#…]`/`border-[#…]` bracket
    color directly inside a `className` (must go through the classNames object)
  - `no-emoji` — no `\p{Extended_Pictographic}` codepoints (inline SVG only)
  - `access-in-separate-file` — `App.jsx` declares no access function (access
    logic lives only in `access.js`)

  (Two further heuristics considered during design — "no component defined
  inside `App`" and "callAI uses a `{ schema: { properties } }` shape" — are
  deliberately deferred; they're noisier to detect statically and can be added
  as rules later without changing the harness.)

  Each rule contributes to a rubric score `passed / total`. The rule set lives
  in one file so it tracks the system prompt as that evolves.

  **Drift guard** (per Charlie's review): each rule declares a `promptAnchor`
  — a short quoted phrase from `prompts/pkg/system-prompt.md` that the rule is
  derived from (e.g. `export default function App()`, `Never use emojis`). A
  test asserts every anchor still appears verbatim in the current system
  prompt and fails fast with the offending rule name when one disappears. This
  is the cheap insurance against a stale rubric silently producing misleading
  adherence scores after the prompt is reworded.

- _LLM feature-completeness judge_ (`src/judge.ts`) — did the app actually
  build what the prompt asked? Sends the prompt + generated `App.jsx`
  (+ `access.js`) to `judgeModel` via the `call-ai` direct-call path, asking for
  a 1–5 score and a one-line justification. Uses the same `LLM_BACKEND_URL` /
  `LLM_BACKEND_API_KEY` transport `preamble-probe` reads from
  `vibes.diy/pkg/.dev.vars`.

**Design** — fetch the deployed screenshot and vision-judge it:

1. Build the screenshot URL from the cell's `appSlug`/`ownerHandle`
   (`https://<appSlug>--<ownerHandle>.<runtimeHostBase>/screenshot.jpg`, the same
   image the `/vibe/` viewer exposes as `og:image`). `runtimeHostBase` is an
   **explicit config field**, not derived from `apiUrl` — in preview the API
   host (`*.workers.dev`) and the runtime host (`pr-<N>.vibespreview.dev`)
   differ, so deriving one from the other would break non-prod runs (per
   Charlie's review). Prod: `vibes.diy`.
2. **Readiness via the `screen-shot-ref` projection** (per Charlie's review).
   Screenshot capture lags the deploy: `/screenshot.jpg` 404s until the
   server has stored a `screen-shot-ref` in the app's meta
   (`vibes.diy/api/svc/public/serv-entry-point.ts`,
   `vibes.diy/api/queue/intern/store-screenshot.ts`). So poll the screenshot
   URL treating **404 = not ready, 200 = ready** — i.e. we observe the meta ref
   through its public projection rather than guessing a fixed delay — up to
   `screenshotTimeoutMs`. (If a CLI/public path to read app meta directly lands
   later, switch to polling the ref itself; the projection is equivalent for
   now and needs no extra auth.)
3. On ready, pass the image to `judgeModel` as an image input with a design
   rubric (layout, hierarchy, contrast, polish, no-emoji adherence) → 1–5 + one
   line.
4. On timeout, record `design: { available: false }` rather than failing the
   cell.

Both judges write their `judgeModel` id into `cell.score.json` (provenance), so
a re-judge with a different model is distinguishable in the output.

### Stage 4 — Report (`src/report.ts`)

The join spine is the set of `cell.json` files (one per cell, always written in
stage 2), **left-joined** with `cell.score.json` where present. This keeps
cells that never scored — generate failures, skipped cells — visible in the
report with empty score columns, rather than silently dropping them. Produces:

- `runs/<ts>/index.jsonl` — one row per cell (machine-readable).
- `runs/<ts>/summary.md` — a matrix table: rows = model (with class/tier),
  columns grouped by prompt × {speed median, adherence rubric, feature judge,
  design judge}. Aggregates reps (median speed, mean scores).

Cost is **not** in the report. The operator joins the table against pricing
(already available from the OpenRouter `/models` endpoint, no token) as a
post-eval filter.

## Workspace layout

```
eval/codegen-matrix/
  package.json              # private workspace; add to root pnpm-workspace.yaml
  README.md
  config/
    matrix.json
    prompts.jsonl
  src/
    generate.ts             # stage 2: model × prompt → deploy via CLI generate
    score.ts                # stage 3 orchestrator
    rubric.ts               # deterministic system-prompt checks
    judge.ts                # call-ai feature + design judges
    report.ts               # stage 4: index.jsonl + summary.md
    config.ts               # load/validate matrix.json + prompts.jsonl
    cell.ts                 # per-cell path + artifact read/write helpers
  runs/                     # gitignored — generated outputs
    .gitignore
```

## Repeatability contract

- New model → add one entry to `matrix.json.models`. No code change.
- New prompt → add one line to `prompts.jsonl`.
- Re-score without re-generating → run stage 3/4 against an existing
  `runs/<ts>/`.
- Pin the platform behavior → set `cliCommand` to a specific
  `vibes-diy@<version>`.

## Error handling

- **Generate is retried.** A generate failure (non-zero exit or no created
  `<appSlug>/` directory) is retried, each attempt in its own clean cwd. Only
  after it fails more than twice (all `MAX_GENERATE_ATTEMPTS` = 3 attempts fail)
  is the cell a model failure → `cell.json` with `exitState: "generate-failed"`,
  the last attempt's `stderrTail`, and `attempts: 3`, and no `cell.score.json`.
  The first successful attempt wins (`exitState: "ok"`, `attempts` = that try's
  number, `latencyMs` = that attempt's time so retries don't inflate the speed
  signal). `attempts` is recorded on `cell.json` and surfaced in `index.jsonl`.
  Every attempt's outcome — including a **concise failure reason** extracted
  from the CLI stderr — is captured in `cell.json.attemptLog` and printed to the
  run log, so retries are auditable.
  Stage 4 joins on `cell.json`, so a failed cell still appears in the report
  with empty score columns (a model that can't produce output is signal).
  (This retries _any_ failure; narrowing to disconnect-signature-only retries is
  a possible future refinement.)
- Judge transport failure → that score recorded as `null`; other scores still
  land.
- Screenshot timeout → `design.available: false`; cell otherwise scored.

## Testing

- `config.ts`: unit tests for matrix/prompts parsing + validation (bad model
  entry, empty prompt).
- `rubric.ts`: unit tests with fixture `App.jsx` files — one that passes every
  rule, and targeted failures (inline component, raw bracket color, emoji,
  missing `export default`, access logic inside `App.jsx`).
- **Rubric drift guard**: a test that loads the live `prompts/pkg/system-prompt.md`
  and asserts every rule's `promptAnchor` still appears in it; fails with the
  rule name when an anchor goes missing.
- `cell.ts`: path/slug derivation and artifact round-trip.
- `generate.ts`/`judge.ts`: network-dependent; covered by a manual smoke run,
  not unit tests (mirrors how `codegen-edit`/`preamble-probe` treat their
  network paths).

## Out of scope (v1)

- Cost computation — post-eval filter applied to the report.
- Multi-turn edit sequences — create-only (single `generate` call per cell).
- CI integration — manual runs for now.
- Compilation/runtime correctness beyond what the screenshot reveals — we score
  observable output, not a test suite per generated app.
