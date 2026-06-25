# Codegen Agentic Eval — Runbook

How to run `eval/codegen-agentic`: a two-mode tenability harness that measures whether open-weight models remain viable when given iterative write-feedback guidance. Runs the same prompts against open-weight and closed models in both one-shot and agentic modes to isolate the tool-loop's contribution to quality and cost.

- Package: [`eval/codegen-agentic`](../eval/codegen-agentic/README.md)
- Spec: [`docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md`](../docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md)
- Judge reuses: `codegen-matrix` scoring barrel (rubric, structure, feature judge)

## One-shot vs agentic: isolating the loop's value

**One-shot**: one completion, model emits complete files in a single turn.
**Agentic**: iterative, model receives `write_file` tool + build + structural feedback on each iteration until passing or hitting `maxSteps`.

Running both modes on the same model/prompt pair reveals:

- **Does iteration help this model?** (agentic score > one-shot score → loop helps)
- **By how much?** (delta in build-pass rate, feature score, $/acceptable)
- **Are open-weight and closed models equally helped by iteration?** (different delta slopes = different scaling with feedback)

## Prerequisites (one-time)

1. **OpenRouter API key** for generation. Store in the macOS Keychain:

   ```sh
   security add-generic-password -a "$USER" -s openrouter-api-key -w "<your-key>"
   ```

   Then pass it at runtime:

   ```sh
   OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" pnpm run generate
   ```

2. **Judge transport** — `LLM_BACKEND_URL` and `LLM_BACKEND_API_KEY` for the `score` stage.
   The `score` stage reuses the judge from `codegen-matrix`:
   - Set as environment variables (cloud agent env wins), OR
   - In `vibes.diy/pkg/.dev.vars` (local dev fallback)
     Set the FULL chat-completions path (call-ai posts to it verbatim):
     `LLM_BACKEND_URL=https://openrouter.ai/api/v1/chat/completions`
     A bare `.../api/v1` (no `/chat/completions`) makes the judge hit an HTML error
     page → 100% null feature scores. The score stage now preflights the judge and
     fails fast if the URL is wrong.
     See [`agents/worktree-setup.md`](worktree-setup.md) for dev setup.

3. `pnpm install` at the repo root.

> **Run from a stable network.** The `generate` stream is long-lived per cell (~1–5 min per model depending on agentic iterations). On a flaky connection, cells drop mid-turn and are recorded as `exitState: "errored"`. Locally the stream holds and you get `ok` cells.

## The three stages

Each stage reads the previous stage's artifacts off disk, so they're decoupled — re-`score`/`report` without re-`generate`, or re-`report` after a code tweak.

```sh
cd eval/codegen-agentic
pnpm run generate   # stage 1: run all (prompt × model × mode × rep) cells
pnpm run score      # stage 2: rubric + structure + LLM feature judge
pnpm run report     # stage 3: aggregate per-model × mode stats + delta table
```

Each stage auto-targets the most recent `runs/<ts>/`. Override with `--run <dir>`.

### Stage 1: generate

**One-shot**: calls the model once with the prompt, parses filename-fenced blocks.
**Agentic**: calls the model with a `write_file` tool, iterates until build + structure pass or `maxSteps` is hit.

Records per cell:

- Files (on disk)
- `cell.json`: metadata (model, mode, promptId, rep, openWeight, needsAccess, exitState, buildPass, steps, costUsd, tokens, note)
- `run.json`: provenance (startedAt, judgeModel, reps, modes, maxSteps, maxCostUsd, models)

Preflight: runs one smoke cell (first model, first prompt, both modes) to catch gross errors before the full sweep.

### Stage 2: score

For each generated cell in the latest `runs/<ts>/`:

- **Rubric** (`runRubric`): checks adherence to system prompt rules (React patterns, Tailwind, no emoji, async patterns, optimistic writes, etc.). Counts passed/total.
- **Structure** (`computeStructure`): detects `useVibe` + `useViewer` presence, Fireproof import, access.js existence, etc.
- **Feature** (`judgeFeature`): LLM reads the prompt + code and scores whether it fulfills the intent (0–5, or null if judge times out). This is the signal for "does it solve the problem?"

Writes `cell.score.json` for each cell.

### Stage 3: report

Reads `cell.json` + `cell.score.json` for each cell and produces:

- `summary.md`: table (model × mode) with build-pass rate, mean feature, acceptable count, $/acceptable
- `index.jsonl`: one row per cell, machine-readable (join against external data)

Then a **delta table**: one-shot → agentic per model, showing improvement in build-pass rate and mean feature score. This isolates the loop's value for each model pair.

## Flags

| Stage    | Flag               | Default                   | Purpose                       |
| -------- | ------------------ | ------------------------- | ----------------------------- |
| generate | `--matrix <path>`  | `config/matrix.json`      | model/mode/budget config      |
| generate | `--prompts <path>` | `config/prompts.jsonl`    | prompt corpus                 |
| generate | `--system <path>`  | `config/system-prompt.md` | codegen rules + output format |
| score    | `--run <dir>`      | latest `runs/<ts>/`       | which run to score            |
| score    | `--prompts <path>` | `config/prompts.jsonl`    | prompt text for judges        |
| report   | `--run <dir>`      | latest `runs/<ts>/`       | which run to report           |

Example: `pnpm run generate -- --matrix /tmp/custom-matrix.json`

## Quick start (trimmed first run)

The default `config/matrix.json` has ~8 open-weight + closed models × 3 prompts × 2 modes × 3 reps = ~144 cells. They run with `concurrency` (default 4 for agentic — generation is slower per cell than codegen-matrix one-shot because of iteration). For a first pass, use a smaller matrix:

```sh
cd eval/codegen-agentic

cat > /tmp/ag-matrix.json <<'JSON'
{
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 1,
  "modes": ["oneshot", "agentic"],
  "concurrency": 2,
  "maxSteps": 4,
  "maxCostUsd": 0.5,
  "budgetUsdTotal": 20,
  "featureAcceptBar": 3,
  "models": [
    { "id": "deepseek/deepseek-chat-v3.1", "openWeight": true },
    { "id": "google/gemini-3.1-pro-preview", "openWeight": false }
  ]
}
JSON

OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" \
  pnpm run generate -- --matrix /tmp/ag-matrix.json

pnpm run score
pnpm run report
cat runs/$(ls -1 runs | grep '^2' | tail -1)/summary.md
```

Scale up by adding models back to `config/matrix.json` (one line each) and raising `reps`.

## Configuration

`config/matrix.json`:

- `judgeModel` — the LLM that scores (default: `anthropic/claude-opus-4.5`).
- `reps` — repetitions per (model × prompt × mode) cell (default 3).
- `modes` — `["oneshot", "agentic"]` or a subset (default: both).
- `concurrency` — parallel cells (default 4; agentic cells run slower than one-shot).
- `maxSteps` — max iterations per agentic cell (default 4; the loop stops when build+structure pass or this is hit).
- `maxCostUsd` — per-cell budget cap (default $0.5). If a single cell exceeds this, it's recorded as `exitState: "errored"` with a cost note.
- `budgetUsdTotal` — hard total budget for the entire run (default $50). Generation stops once this is spent (remaining jobs are skipped).
- `featureAcceptBar` — minimum LLM feature score to count as "acceptable" (default 3 out of 5).
- `models` — array of `{ id, openWeight }`. Models can be any OpenRouter model id (deepseek, qwen, mistral, google, anthropic, etc.).

`config/prompts.jsonl` — one `{ "id", "prompt", "needsAccess" }` per line:

- `collab-lists` (needsAccess: true) — multi-list todo, per-list invite, Fireproof
- `audio-synth` (needsAccess: false) — Web Audio synth with ADSR envelopes
- `recipe-shop` (needsAccess: false) — recipe → shopping list via AI + toggle + suggestions

`config/system-prompt.md` — codegen rules (React, Tailwind, Fireproof, callAI, access.js, loading states, optimistic writes, etc.). Copied from `prompts/pkg/system-prompt-initial.md` minus the vibes-parser I/O protocol (SEARCH/REPLACE edits, `{{TEMPLATE}}` placeholders). Ends neutrally: "Produce a complete, working `App.jsx`. If the app needs per-document write validation or channel-based read isolation, also produce a separate `access.js`."

## Cost guardrails

1. **Preflight**: one smoke cell (first model, first prompt, both modes) runs before the sweep. If either mode errors, generation halts.

2. **Per-cell cap**: if a single cell exceeds `maxCostUsd`, it's halted and recorded as `exitState: "errored"`.

3. **Aggregate cap**: `budgetUsdTotal` is a hard halt. Once spent, remaining jobs are skipped. Check `stderr` for "budget" messages during the run.

4. **One-shot vs agentic cost**: one-shot is typically cheaper (one completion); agentic is typically more expensive (multiple iterations × feedback). The cost per cell appears in `cell.json.costUsd` and is summed in the report as $/acceptable.

## Reading results

`runs/<ts>/summary.md` — table with one row per (model, mode) pair:

| Column       | Meaning                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| model        | OpenRouter model id                                                                         |
| open?        | open-weight or closed                                                                       |
| mode         | oneshot or agentic                                                                          |
| n            | number of cells (reps × prompts)                                                            |
| build-pass   | % of cells that passed esbuild structural check                                             |
| mean feature | average LLM feature judge score (0–5)                                                       |
| acceptable   | count / n of cells that (build-passed && feature >= bar && (!needsAccess \|\| hasAccessJs)) |
| $/acceptable | total cost ÷ acceptable cells; null if no acceptable cells                                  |
| mean $/gen   | total cost ÷ all cells                                                                      |

Then a **delta table**: one-shot → agentic per model:

| Column       | Meaning                                             |
| ------------ | --------------------------------------------------- |
| model        | model id                                            |
| build-pass   | one-shot% → agentic% (delta shown as +/-)           |
| mean feature | one-shot score → agentic score (delta shown as +/-) |

**Interpreting the delta:**

- **Both deltas positive** → agentic helps; iteration + feedback improve both build-pass and feature score.
- **Build-pass positive, feature flat/negative** → iteration helps with syntax, but the model doesn't solve the problem better.
- **Both negative** → agentic hurts; the loop confuses the model or feedback is noisy.
- **Feature positive, build-pass negative** → agentic produces more functional code but less syntactically correct.

The tenability question: **For open-weight models, is the delta steep enough to justify the added cost?** If an open-weight model's agentic improvement is small (< +5% build-pass, < +0.5 feature) and agentic costs 3× more, it's not worth the loop. If the delta is steep (+20% build-pass, +1.5 feature), the loop is earning its cost.

`runs/<ts>/index.jsonl` — one row per cell:

```json
{
  "model": "...",
  "mode": "oneshot",
  "openWeight": true,
  "promptId": "collab-lists",
  "needsAccess": true,
  "buildPass": true,
  "feature": 4,
  "costUsd": 0.025,
  "hasAccessJs": true
}
```

Use for custom analysis (e.g., "do open-weight models fail `collab-lists` more often than closed models?").

## Behavior to know

- **Parallel cells**: `generate` runs up to `concurrency` cells at once (default 4). Agentic cells are slower (~1–5 min each depending on iteration count); one-shot cells are faster (~20–60s). Within a cell, agentic iterations stay sequential (loop until pass or maxSteps).
- **Build-check is structural, not full lint**: esbuild transform confirms the code parses and refs are valid. It does NOT run the vibes linter (no import graph, no a11y, etc.). A cell can pass build-check and still fail the real lint on deploy.
- **v1 is source-only (no design judge)**: every signal scores the generated source on disk. v1 never renders, deploys, or screenshots a cell, so there is no design/visual/render judge — it measures plausible source, not how the running app looks or behaves. A render/design judge is out of scope for v1.
- **Access-js requirement**: when `needsAccess: true`, the cell is only acceptable if `access.js` is present. The executor checks this and returns feedback if missing.
- **Feature score nulls**: if the judge backend times out or errors, that cell's feature score is null. They still count toward build-pass rate. Re-run `score` to retry; some transient errors will pass.
- **Preflight guards**: the smoke run catches obvious model-level errors (e.g., the model is unavailable, the API key is wrong) before spending budget on the full sweep.

## Troubleshooting

| Symptom                                                     | Cause / fix                                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY is not set` on `generate`               | Set it: `OPENROUTER_API_KEY="..." pnpm run generate` or store in Keychain (see Prerequisites).                                                                 |
| `LLM_BACKEND_URL` / `LLM_BACKEND_API_KEY` error on `score`  | Set them as env vars or in `vibes.diy/pkg/.dev.vars`. Environment variables win.                                                                               |
| `judge preflight failed` on `score`                         | `LLM_BACKEND_URL` is missing `/chat/completions`. Use the full path.                                                                                           |
| Preflight logs "transient error after retries — continuing" | A smoke-model provider blip; the sweep proceeds. Only a non-transient error (bad key / model id) aborts.                                                       |
| All cells `exitState: "errored"` with "Step count exceeded" | agentic `maxSteps` is too low for the model. Raise it or shorten prompts.                                                                                      |
| All cells `exitState: "errored"` with cost exceeded         | agentic iterations are expensive. Raise `maxCostUsd` or use cheaper models.                                                                                    |
| High null feature scores                                    | Judge backend is flaky. Re-run `score` to retry. Some transient timeouts pass on retry.                                                                        |
| One-shot much cheaper but feature not lower                 | the model solves the prompt on first try; iteration doesn't help (expected for simpler prompts).                                                               |
| Open-weight agentic is much more expensive than closed      | open-weight models may take more iterations to solve the prompt. If the feature delta doesn't justify it, they're less viable on this loop-sensitive workload. |
| Want to score an old run                                    | `pnpm run score -- --run runs/<ts>` then `pnpm run report -- --run runs/<ts>`.                                                                                 |

## Tests

`cd eval/codegen-agentic && pnpm test` (or `pnpm exec vitest --run --project eval-codegen-agentic` from root).

Pure modules are unit-tested:

- File parsing (one-shot filename-fenced extraction)
- Build-check (esbuild structural validation)
- Prompt building (per-mode instruction branching)
- Cost extraction (response.totalCost normalization)
- Config parsing (matrix + prompts.jsonl validation)
- Concurrency pool (bounded parallelism)
- Feedback evaluation (build + structure → loop message)
- Agentic executor loop (write_file tool behavior, iteration logic)

Live paths (`generate`, `score`, `report`) are validated by manual smoke runs.

For type-check: `pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json`.
