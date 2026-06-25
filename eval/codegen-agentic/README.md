# Codegen Agentic Eval

Two-mode (one-shot vs agentic) code generation tenability evaluation. Runs the same prompts against open-weight and closed models in both modes, isolating the tool-loop's contribution to output quality and cost. Measures whether open-weight models stay viable when given iterative write-feedback guidance.

- Package: `@vibes.diy/eval-codegen-agentic`
- Spec: [`docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md`](../../docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md)
- Runbook: [`agents/codegen-agentic-eval.md`](../../agents/codegen-agentic-eval.md)

## Purpose: confound removal via two modes

**One-shot** is a single completion: the model emits complete files in one turn.
**Agentic** adds a `write_file` tool: the model iterates, receiving build + structural feedback on each write until it passes.

Both run the same model on the same prompt; the delta (agentic score – one-shot score) isolates the tool-loop's value. If agentic outperforms one-shot, the loop helps; if equal, the model solved it on first try; if worse, the loop confuses the model or the feedback is noisy.

### Prompt corpus

Three prompts from `config/prompts.jsonl`:

- `collab-lists`: Multi-list todo with per-list invite and Fireproof persistence. **Requires `access.js`** (`needsAccess: true`).
- `audio-synth`: Web Audio synthesizer with ADSR envelope sliders. **No permissions needed** (`needsAccess: false`).
- `recipe-shop`: Recipe → shopping list via AI schema extraction + toggle + substitution hints. **No permissions** (`needsAccess: false`).

### Models and tenability

Models in `config/matrix.json` are tagged `openWeight: true/false`. The eval answers:

- **Can open-weight models stay viable when given iteration + feedback?** (agentic mode)
- **At what cost?** ($/acceptable-solution)
- **Do the open-weight and closed models have the same relationship to iteration**, or does one benefit more?

## The three stages

Each stage reads the previous stage's artifacts off disk, so they're decoupled.
Re-`score`/`report` without re-`generate`, or re-`report` after a code tweak.

```sh
cd eval/codegen-agentic
pnpm run generate   # stage 1: generate one-shot + agentic for each model × prompt × rep
pnpm run score      # stage 2: rubric + structure + LLM feature judge over the latest run
pnpm run report     # stage 3: aggregate stats + delta + $/acceptable table
```

Each stage auto-targets the most recent `runs/<ts>/`. Override with `--run <dir>`.

### Flags

| Stage    | Flag               | Default                   | Purpose                       |
| -------- | ------------------ | ------------------------- | ----------------------------- |
| generate | `--matrix <path>`  | `config/matrix.json`      | model/mode/budget conf        |
| generate | `--prompts <path>` | `config/prompts.jsonl`    | prompt corpus                 |
| generate | `--system <path>`  | `config/system-prompt.md` | codegen rules + output format |
| score    | `--run <dir>`      | latest `runs/<ts>/`       | which run to score            |
| score    | `--prompts <path>` | `config/prompts.jsonl`    | prompt text for judges        |
| report   | `--run <dir>`      | latest `runs/<ts>/`       | which run to report           |

Pass flags through the pnpm script with `--`, e.g.
`pnpm run generate -- --matrix /tmp/my-matrix.json`.

## Prerequisites

1. **OpenRouter API key** (for generation):

   ```sh
   OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" pnpm run generate
   ```

   The key is read from `OPENROUTER_API_KEY` at runtime and never logged. Store it in the macOS Keychain:

   ```sh
   security add-generic-password -a "$USER" -s openrouter-api-key -w "<your-key>"
   ```

2. **Judge transport** (`LLM_BACKEND_URL` + `LLM_BACKEND_API_KEY` for the `score` stage):
   The `score` stage reuses the same judge backend as `codegen-matrix`. Set them:
   - As environment variables (cloud agent env prefers this), OR
   - In `vibes.diy/pkg/.dev.vars` (local dev fallback)
     Use the full chat-completions path: `LLM_BACKEND_URL=https://openrouter.ai/api/v1/chat/completions`.
     A bare `.../api/v1` (without `/chat/completions`) makes the judge hit an HTML error page.
     Environment variables win. See [`agents/worktree-setup.md`](../../agents/worktree-setup.md).

3. `pnpm install` at the repo root.

## Configuration

`config/matrix.json`:

- `judgeModel` — the LLM that scores each cell (default: `anthropic/claude-opus-4.5`).
- `reps` — repetitions per (prompt × model × mode) cell.
- `modes` — array of `["oneshot", "agentic"]` or a subset (default: both).
- `concurrency` — cells run in parallel (default 4).
- `maxSteps` — max iterations per agentic cell (default 4).
- `maxCostUsd` — budget cap per cell (default $0.5).
- `budgetUsdTotal` — hard total budget for the entire run (default $50).
- `featureAcceptBar` — minimum LLM feature score to count as "acceptable" (default 3).
- `models` — array of `{ id, openWeight }` tuples.

`config/prompts.jsonl` — one `{ "id", "prompt", "needsAccess" }` per line.

`config/system-prompt.md` — the codegen system prompt. Copied from `prompts/pkg/system-prompt-initial.md` but omits the vibes prompt I/O protocol (SEARCH/REPLACE, `{{TEMPLATE}}` placeholders, etc.). Ends with a neutral instruction: "Produce a complete, working `App.jsx`. If the app needs per-document write validation or channel-based read isolation, also produce a separate `access.js`."

## Output and build-check

### One-shot mode

The model outputs filename-fenced blocks:

````
App.jsx
```jsx
export default function App() { ... }
````

access.js (optional)

```js
export function access(...) { ... }
```

```

The `parseFiles` parser extracts them.

### Agentic mode

The model calls the `write_file` tool with `{ path, contents }` once per iteration.
The executor runs `buildCheck` (esbuild structural parse) after each write and returns `{ ok, feedback }`.
The model iterates until `ok: true` or `maxSteps` is reached.

### Build check (not the full vibes lint)

`buildCheck` runs **esbuild** transform on each `.js`/`.jsx`/`.ts`/`.tsx` file with JSX auto-import; treats all bare imports as external (no actual resolution); confirms the code **parses** and **references are structurally valid**. It is a structural esbuild gate, NOT the real vibes lint (no import validation, no a11y checks, etc.) — just a parse gate. A cell can pass the build-check and still fail at the real vibes lint on deployment.

### v1 is source-only (no design judge)

**This eval scores generated source only — there is no design judge.** v1 never renders or deploys a cell: it does not run the app, capture a screenshot, or visually judge the rendered output. Every signal (build-check, rubric, structure, feature judge) reads the source code on disk. So this harness measures whether models produce *structurally and functionally plausible source*, not whether the running app looks or behaves correctly. A render/design judge is explicitly out of scope for v1.

### `access.js` requirement

When a prompt's `needsAccess: true` (the `collab-lists` prompt), the cell is **not acceptable** unless `access.js` is present. The `evaluateProgress` executor checks this.

## Scoring (reuses codegen-matrix judges)

The `score` stage runs three judges per cell (outputs are files on disk):

1. **Rubric** (`runRubric`): checks adherence to the system prompt rules (React patterns, Tailwind, no emoji, etc.). Counts passed/total rules.
2. **Structure** (`computeStructure`): detects `useVibe` presence, `useViewer` presence, Fireproof import, access.js existence, etc. Returns boolean flags.
3. **Feature** (`judgeFeature`): calls an LLM with the original prompt + generated code to judge whether the code **fulfills the prompt intent**. Returns a score (0–5) or null if the judge errors.

The `featureAcceptBar` (default 3) is the minimum feature score to count a cell as "acceptable."

## Behavior to know

- **Generation calls retry transient errors**: when a generation call (one-shot or agentic) encounters a transient infra error (5xx, network timeout), it retries automatically up to `maxRetries` times (default 2, for 3 total attempts). Non-transient errors (4xx, parse) fail immediately.
- **Preflight aborts only on non-transient errors**: the `generate` stage runs a smoke cell (first model, first prompt, both modes) as a preflight. If the cell hits a non-transient error, generation aborts. Transient errors log a warning and the full sweep proceeds (cells may still error).
- **Judge preflight for the score stage**: the `score` stage calls `assertJudgeReachable` before scoring, which probes the judge backend with a single test call. If the judge returns a null score (e.g., because `LLM_BACKEND_URL` is missing `/chat/completions`), the score stage fails fast with an actionable error instead of producing an all-null report.

## Reading results

`runs/<ts>/summary.md` — per-model × mode table with:
- Build-pass rate (what % of 3 reps passed `buildCheck`)
- Mean feature score (across reps that scored)
- Acceptable count / total (cells where `buildPass && feature >= bar && (!needsAccess || hasAccessJs)`)
- $/acceptable (total cost ÷ acceptable cells)
- Mean $/gen (total cost ÷ all cells)

Then a **delta table**: one-shot → agentic per model, showing the improvement (or regression) in build-pass rate and mean feature score.

`runs/<ts>/index.jsonl` — one row per cell (machine-readable); use for custom analysis.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `OPENROUTER_API_KEY is not set` on `generate` | Provide it as an env var: `OPENROUTER_API_KEY="..." pnpm run generate`. Or store in Keychain with the one-liner above. |
| `LLM_BACKEND_URL` / `LLM_BACKEND_API_KEY` error on `score` | Set them as env vars or in `vibes.diy/pkg/.dev.vars`. Environment variables win. |
| Many cells `exitState: "errored"` | Check the `cell.json` `note` field for the error. Often a model timeout or parse failure. |
| Many `feature: null` scores | The judge backend failed or timed out on those cells. Re-run `score` to retry the nulls; some transient errors will pass on retry. |
| Want to score an old run | `pnpm run score -- --run runs/<ts>` then `pnpm run report -- --run runs/<ts>`. |

## Tests

`cd eval/codegen-agentic && pnpm test` (or `pnpm exec vitest --run --project eval-codegen-agentic` from root). Pure modules are unit-tested (file parsing, build-check, prompt building, cost extraction, config parsing, concurrency pool, feedback evaluation, agentic executor loop); the live generate/score paths are validated by a manual run.

For type-check: `pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json`.
```
