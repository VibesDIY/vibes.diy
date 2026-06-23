# `@vibes.diy/eval-codegen-matrix`

Runs a fixed set of prompts across a configurable set of models (via the
published `vibes-diy generate` CLI) and scores each `(model × prompt)` cell on
**speed**, **adherence** (deterministic rubric + LLM feature judge), and
**design** (vision judge over the deployed screenshot).

Adding a model is a one-line edit to `config/matrix.json`. Cost is not scored —
it's a post-eval filter you apply to `summary.md` using OpenRouter pricing.

## Prerequisites

- Logged-in `vibes-diy` CLI (`vibes-diy login`) with access to the `eval` handle.
- `vibes.diy/pkg/.dev.vars` populated with `LLM_BACKEND_URL` + `LLM_BACKEND_API_KEY`
  (the judge transport, same file `eval/preamble-probe` reads).

## Run (three stages)

```sh
cd eval/codegen-matrix
pnpm run generate   # stage 2: deploy one vibe per model × prompt × rep
pnpm run score      # stage 3: rubric + judges over the latest run
pnpm run report     # stage 4: index.jsonl + summary.md for the latest run
```

Each stage targets the most recent `runs/<ts>/` unless `--run <dir>` is passed.
`generate` writes `run.json` (provenance) + one `cell.json` per cell; `score`
adds `cell.score.json`; `report` joins them.

## Config

- `config/matrix.json` — `cliCommand`, `apiUrl` (target env; run most iterations
  non-prod, a confirmation set on prod), `runtimeHostBase` (the deployed vibe's
  hostname base — `vibes.diy` for prod, `pr-<N>.vibespreview.dev` for preview;
  kept explicit because the API and runtime hosts differ in preview), `handle`,
  `judgeModel`, `reps`, `screenshotTimeoutMs`, and the `models` list (cheapest +
  priciest per class).
- `config/prompts.jsonl` — one `{id, prompt}` per line.

## Notes

- Runs are sequential to avoid rate-limit noise in results.
- **Generate is retried up to 3 attempts per cell** (each in its own clean cwd).
  The first success wins; only after it fails more than twice is the cell a
  model failure (`exitState: "generate-failed"`). The attempt count and each
  attempt's failure reason are recorded in `cell.json` (`attempts` +
  `attemptLog`) and printed to the run log.
- The rubric's rules each declare a `promptAnchor`; a vitest drift guard fails
  if an anchor stops appearing in `prompts/pkg/system-prompt.md`, so a reworded
  system prompt can't silently invalidate adherence scores.
