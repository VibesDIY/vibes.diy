# Codegen Matrix Eval — Runbook

How to run `eval/codegen-matrix`: the harness that runs a fixed set of prompts
across a configurable set of models (via the published `vibes-diy generate`
CLI) and scores each `(model × prompt)` cell on **speed**, **adherence** (to the
codegen system prompt), and **design quality**.

- Package: [`eval/codegen-matrix`](../eval/codegen-matrix/README.md)
- Spec: [`docs/superpowers/specs/2026-06-23-codegen-matrix-eval-design.md`](../docs/superpowers/specs/2026-06-23-codegen-matrix-eval-design.md)
- Adding a model is a **one-line edit** to `config/matrix.json` — no code change.
- Cost is **not** scored; it's a post-eval filter you apply to the result table.

## Prerequisites (one-time)

1. **Logged-in CLI** with access to the `eval` handle:
   ```sh
   npx vibes-diy@latest login
   ```
2. **Judge transport** — `vibes.diy/pkg/.dev.vars` must contain
   `LLM_BACKEND_URL` and `LLM_BACKEND_API_KEY` (same file the dev server and
   `eval/preamble-probe` read). The `score` stage needs this; `generate` does
   not. See [`worktree-setup.md`](./worktree-setup.md) if you haven't set up
   local dev.
3. `pnpm install` at the repo root.

> **Run from a stable network, not an ephemeral cloud session.** The `generate`
> stream is long-lived; on a flaky connection it disconnects mid-turn and the
> cell is recorded as `generate-failed` (after retries). Locally the stream
> holds and you get `ok` cells.

## The three stages

Each stage reads the previous stage's artifacts off disk, so they're decoupled —
re-`score`/`report` without re-`generate`, or re-`report` after a code tweak.

```sh
cd eval/codegen-matrix
pnpm run generate   # stage 2: deploy one vibe per model × prompt × rep
pnpm run score      # stage 3: rubric + LLM judges over the latest run
pnpm run report     # stage 4: write index.jsonl + summary.md for the latest run
```

Each stage auto-targets the most recent `runs/<ts>/`. Override with `--run`.

### Flags

| Stage    | Flag                 | Default                  | Purpose                  |
| -------- | -------------------- | ------------------------ | ------------------------ |
| generate | `--matrix <path>`    | `config/matrix.json`     | model/judge/env config   |
| generate | `--prompts <path>`   | `config/prompts.jsonl`   | prompt corpus            |
| generate | `--concurrency <n>`  | `matrix.concurrency` (8) | cells run in parallel    |
| score    | `--run <dir>`        | latest `runs/<ts>/`      | which run to score       |
| score    | `--prompts <path>`   | `config/prompts.jsonl`   | prompt text for judges   |
| score    | `--judge-model <id>` | `matrix.judgeModel`      | override the judge model |
| score    | `--concurrency <n>`  | `matrix.concurrency` (8) | cells scored in parallel |
| report   | `--run <dir>`        | latest `runs/<ts>/`      | which run to report      |

Pass flags through the pnpm script with `--`, e.g.
`pnpm run generate -- --matrix /tmp/my-matrix.json`.

## Quick start (trimmed first run)

The default `config/matrix.json` is **11 models × 3 prompts × 3 reps = 99
cells**. They run `concurrency` at a time (default 8), each generate up to 3
attempts at ~40–90s — so the full matrix is roughly `99 / concurrency` waves.
Raise `concurrency` (or `--concurrency`) to go faster. For a first pass, point
at trimmed configs:

```sh
cd eval/codegen-matrix

cat > /tmp/cm-matrix.json <<'JSON'
{
  "cliCommand": "npx vibes-diy@latest",
  "apiUrl": "https://vibes.diy/api?.stable-entry.=cli",
  "runtimeHostBase": "vibes.diy",
  "handle": "eval",
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 1,
  "screenshotTimeoutMs": 120000,
  "models": [
    { "id": "anthropic/claude-sonnet-4.6", "class": "anthropic", "tier": "cheap" },
    { "id": "google/gemini-2.5-flash-lite", "class": "google", "tier": "cheap" }
  ]
}
JSON

printf '%s\n' '{"id":"counter","prompt":"Build a simple counter with an increment button. Persist the count in Fireproof."}' > /tmp/cm-prompts.jsonl

pnpm run generate -- --matrix /tmp/cm-matrix.json --prompts /tmp/cm-prompts.jsonl
pnpm run score   -- --prompts /tmp/cm-prompts.jsonl
pnpm run report
cat runs/$(ls -1 runs | grep '^2' | tail -1)/summary.md
```

Scale up by adding models back to `config/matrix.json` (one line each) and
raising `reps`.

## Output layout (all under `runs/<ts>/`, gitignored)

```
runs/<ts>/
  run.json                       # provenance: apiUrl, cliVersion, commit SHA, judgeModel, reps, promptsHash
  <prompt>__<model>__rN/
    attempt-1/ … attempt-3/      # per-attempt CLI working dirs (appSlug subdir inside)
    cell.json                    # result + attempts + attemptLog (per-attempt failure reasons)
    cell.score.json              # rubric + feature + design scores (absent if generate-failed)
  index.jsonl                    # one row per cell (machine-readable)
  summary.md                     # the matrix table you read
```

`summary.md` rows = model (with class/tier); columns grouped by prompt ×
{median speed, rubric ratio, feature judge, design judge}, aggregated across
reps (median speed, mean scores). Failed cells stay visible with empty score
columns.

## Configuration

`config/matrix.json`:

- `cliCommand` — the generate mechanism; pin to `vibes-diy@<version>` for a
  reproducible run.
- `apiUrl` — target env. Run most iterations against a non-prod env and a
  smaller confirmation set on prod.
- `runtimeHostBase` — the **deployed vibe's** hostname base (NOT the API host —
  they differ in preview). Prod: `vibes.diy`. Preview:
  `pr-<N>.vibespreview.dev`. The screenshot URL is
  `https://<appSlug>--<ownerHandle>.<runtimeHostBase>/screenshot.jpg`.
- `handle` — publish namespace (`eval`).
- `concurrency` — cells run in parallel per stage (default 8). Raise it to cut
  wall-clock time; `generate` deploys tolerate high concurrency.
- `judgeModel`, `reps`, `screenshotTimeoutMs`, and the `models` list (cheapest +
  priciest per class).

`config/prompts.jsonl` — one `{ "id", "prompt" }` per line.

## Behaviour to know

- **Parallel cells** — both `generate` and `score` run up to `concurrency`
  cells at once (config field, default 8; override per stage with
  `--concurrency <n>`). `generate` deploys tolerate high concurrency, so this is
  the main lever on wall-clock time — raise it to run the full matrix fast.
  Within a cell, the up-to-3 generate attempts stay sequential.
- **Generate retries** — a failure is retried, each attempt in its own clean
  cwd. Only after it fails **more than twice** (all 3 attempts) is the cell a
  model failure. First success wins, recorded with that attempt's latency.
  Every attempt's outcome + a concise failure `reason` is captured in
  `cell.json.attemptLog` and printed to the run log.
- **Rubric drift guard** — each rubric rule declares a `promptAnchor`; a vitest
  test fails if an anchor stops appearing in `prompts/pkg/system-prompt.md`, so
  a reworded system prompt can't silently invalidate adherence scores. If it
  fires, update the rule's anchor to current verbatim text (don't weaken the
  guard).

## Reading results / cost filter

Cost is not in the report. Join `summary.md` against OpenRouter pricing (public
`GET https://openrouter.ai/api/v1/models`, no token — each model carries a
`pricing` object) and pick the cheapest model that clears your adherence/design
bar.

## Troubleshooting

| Symptom                                                                                  | Cause / fix                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| All cells `generate-failed`, `attemptLog` shows "Stream ended before the turn completed" | Flaky network from this environment. Run from a stable connection; the retries already gave it 3 tries.                                    |
| `score` throws about `LLM_BACKEND_URL` / `LLM_BACKEND_API_KEY`                           | `vibes.diy/pkg/.dev.vars` is missing the judge keys (see Prerequisites).                                                                   |
| `design.available: false` on a cell                                                      | Screenshot wasn't ready within `screenshotTimeoutMs` (capture lags the deploy). Raise the timeout or re-`score`.                           |
| `cliVersion: "unknown"` in `run.json`                                                    | The CLI prints its version to stderr; the harness scans both streams — if still unknown, `npx vibes-diy@latest --version` isn't resolving. |
| Want to score an old run                                                                 | `pnpm run score -- --run runs/<ts>` then `pnpm run report -- --run runs/<ts>`.                                                             |

## Tests

`cd eval/codegen-matrix && pnpm test` (or `pnpm exec vitest --run --project
eval-codegen-matrix` from root). Pure logic (config, cell, rubric+drift-guard,
readiness, judges' helpers, generate retry loop, report aggregation) is unit
tested; the live `generate`/judge paths are validated by a manual smoke run.
For type changes, run `pnpm run build` (tsc) too — vitest uses esbuild and does
not type-check.
