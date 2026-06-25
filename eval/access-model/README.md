# `eval/access-model` — access-model codegen eval

Drives `vibes-diy generate` over the #2588 8-prompt matrix (plus a hidden holdout) on the **pinned default codegen model**, statically grades the generated `access.js` / `App.jsx` against the access-model invariants, runs one "second signed-in visitor" LLM judge, computes a composite PASS/SOFT/FAIL metric, and enforces 5 discard-gates behind a single `verify` command so [`/autoresearch`](../../.claude/skills/autoresearch/SKILL.md) can iterate the `prompts/pkg/**` corpus and keep/discard against the metric.

The autoresearch config block + loop discipline live in [`agents/access-model-autoresearch.md`](../../agents/access-model-autoresearch.md). The access-model grammar the grader encodes is in [`docs/superpowers/specs/2026-06-24-vibe-access-model-design.md`](../../docs/superpowers/specs/2026-06-24-vibe-access-model-design.md). Issues: VibesDIY/vibes.diy#2602 (the loop, scope, metric, gates, concurrency, baseline), #2588 (eval playbook + pass criteria), #2595.

### Two rubrics, side by side (#2631)

Every scored cell is graded twice and the report prints both metrics:

- **`METRIC`** — the original **shape-rigid** rubric: the access shape must match the prompt's dimension (per-visitor / per-object / owner-published / author-owned / multi-tier), with Form-A and the second-visitor judge. This is what the frozen `baseline.json` and the discard-gates compare against.
- **`CONSENT METRIC`** — a **consent-centric** rubric where collaboration is _never_ counted against a shape (a todo is an object graph like any other; inviting collaborators with consent is legitimate). A cell fails only on (1) the retired **`isOwner` token** (a hard fail in both rubrics), (2) a **consent leak** — access to data another user owns, or membership, granted without the owner's/creator's consent — or (3) a **true dead-end** where a second visitor has no consent-respecting path (can't start their own _and_ can't request to join). Driven by a separate consent judge (`hasConsentPath` + `accessLeakedWithoutConsent`).

## The three stages

Each stage is a `tsx` entrypoint with a `pnpm run` script. Pass flags after a `--` separator (`pnpm run <stage> -- <flags>`).

```bash
pnpm run generate   # tsx src/generate.ts — vibes-diy generate × (prompts × reps), pulls access.js + App.jsx
pnpm run score      # tsx src/score.ts    — invariants + renderable + judge → cell.score.json per cell
pnpm run report     # tsx src/report.ts   — aggregate → results.json + access-summary.md, prints METRIC
```

A run is a directory under `runs/`. `generate` creates it (timestamped, or `--run <dir>`) and writes `run.json` (the pinned `model`, `apiUrl`, `cliVersion`, `commitSha`, `handle`, `reps`, the resolved `concurrency`, and `promptsFile`) plus one cell dir per `(prompt, rep)`. `score` and `report` operate on the same run dir.

### Stage flags (accurate to `src/*.ts`)

| Flag                | `generate` | `score` | `report` | Meaning                                                                                                          |
| ------------------- | :--------: | :-----: | :------: | ---------------------------------------------------------------------------------------------------------------- |
| `--matrix <path>`   |    yes     |   yes   |    —     | matrix config; defaults to `config/matrix.json`                                                                  |
| `--prompts <path>`  |    yes     |    —    |    —     | prompt corpus; defaults to `config/prompts.eval.jsonl` (or the holdout when `--holdout` is set)                  |
| `--holdout`         |    yes     |    —    |    —     | use `config/prompts.holdout.jsonl` instead of the eval corpus                                                    |
| `--concurrency <n>` |    yes     |    —    |    —     | parallel `generate` cells; defaults to `matrix.concurrency` (32). Recorded in `run.json`                         |
| `--run <dir>`       |    yes     |   yes   |   yes    | the run dir. `generate` creates it; `score`/`report` default to the most-recently-modified dir under `runs/`     |
| `--reps <n>`        |    yes     |    —    |    —     | reps per prompt this wave; defaults to `matrix.reps` (4). The adaptive top-up uses this for the second wave      |
| `--rep-start <n>`   |    yes     |    —    |    —     | first rep index (default 0); a top-up wave passes `--rep-start 4` so it appends without clobbering the base      |
| `--only <id,id>`    |    yes     |    —    |    —     | restrict generation to a comma-separated subset of prompt ids (the top-up wave passes the unsaturated ids)       |
| `--skip-scored`     |     —      |   yes   |    —     | score only cells without an existing `cell.score.json` (the top-up wave uses this so base cells aren't rejudged) |

`generate` appends to an existing `--run` dir (it never wipes it and preserves the original `run.json`), so a second wave with a higher `--rep-start` adds reps to the same run. `score` uses `matrix.scoreConcurrency` (8) for its own fan-out; it is not overridable per-invocation.

Typical full run on the eval matrix:

```bash
pnpm run generate -- --run runs/today
pnpm run score    -- --run runs/today
pnpm run report   -- --run runs/today   # prints METRIC=<x>
```

### Adaptive reps (`pnpm run adaptive`)

Uniform reps over-sample easy prompts (which saturate at 1.00 by rep 2–3) and under-sample the noisy ones. The adaptive batch runs a **base wave of `matrix.reps` (4)** for every prompt, scores it, then runs a **top-up wave** (rep indices `reps..repsMax-1`) for **only the prompts whose base-wave reps disagree** — saturated prompts stay at 4, variable ones climb to `matrix.repsMax` (8). Net: fewer cells, same keep/discard decision.

```bash
pnpm run adaptive -- --run runs/today            # eval matrix, adaptive
pnpm run adaptive -- --holdout --run runs/today-h # holdout matrix, adaptive
```

`verify` runs the adaptive batch for both the eval and holdout matrices (a fresh run dir each time).

## The `verify` command (the autoresearch `Verify:`)

```bash
pnpm run verify   # tsx src/verify.ts
```

This is the exact shell command `/autoresearch` runs each iteration. It orchestrates all five gates end-to-end — gate 1, then the eval matrix (`generate → score → report`), then the holdout matrix, then the prompt-diff guardrail, then compares the rates/metrics against the **frozen** `baseline.json`. It prints a parseable `METRIC=<x>` line and a `GATES: pass` / `GATES: FAIL(<failed,gates>)` line, and **exits non-zero on any gate failure** so the loop discards the iteration even when the metric improved.

The five discard-gates (#2602):

1. **`check`** — prompts package build + tests **and** the `promptAnchor` rubric drift-guard (`eval/codegen-matrix/src/rubric.test.ts`, which asserts every rule's `promptAnchor` still appears in the system prompt). Scoped via `pnpm --filter` so the whole-repo `pnpm check` is not run every iteration.
2. **`two-file-emission`** — the run's two-file rate must not drop below `baseline.twoFileRate` (minus the noise band).
3. **`renderable`** — the run's renderable rate must not drop below `baseline.renderableRate` (minus the band).
4. **`guardrail`** — the `prompts/pkg/` diff must pass the design-doc guardrail (grep-first; degrades to the grep verdict if the judge is unavailable).
5. **`holdout-regression`** — the holdout metric must not drop below `baseline.holdout.metric` (minus the band).

## Config

- **`config/matrix.json`** — the run config. `model` is pinned to **`anthropic/claude-opus-4.8`** (passed as `--model` to every `generate`, recorded in `run.json`, so every iteration is byte-identical on the model axis). Also: `apiUrl` (cli stable-entry), `handle: eval`, `judgeModel`, `reps: 4` (adaptive base wave), `repsMax: 8` (adaptive cap), `concurrency: 32`, `scoreConcurrency: 8`. A later default-model bump must explicitly invalidate `baseline.json` — never silently move it.
- **`config/prompts.eval.jsonl`** — the 8 #2588 prompts, one JSON object per line (`{id, prompt, dimension, expect}`), spanning the five dimensions: `per-visitor`, `per-object`, `owner-published`, `author-owned`, `multi-tier`.
- **`config/prompts.holdout.jsonl`** — 8 _different_ prompts spanning the same five dimensions. **Hidden from the modify step**: the autoresearch loop edits `prompts/pkg/**` but must never see these prompts, so a kept win generalizes rather than overfitting the eval matrix. The holdout drives gate 5.

## `baseline.json` — the frozen reference

The `≥-baseline` gates (2, 3, 5) compare the current run against `baseline.json`. It is captured **once**, on the kickoff checkout, and frozen — the autoresearch loop may not edit what scores it.

```bash
pnpm exec tsx src/baseline.ts            # capture (refuses to overwrite an existing baseline)
pnpm exec tsx src/baseline.ts -- --force # re-capture after a deliberate model/grader change
```

Capture refuses to overwrite an existing `baseline.json` without `--force`. A **default-model bump must invalidate the baseline** (re-capture with `--force`); the old baseline was measured on a different model and is no longer a valid floor.

## Concurrency step-down lever

`generate` defaults to `matrix.concurrency` (32). When the target env throttles or returns dispatch errors under load, step it down — **32 → 16 → 8** — via the `--concurrency` flag:

```bash
pnpm run generate -- --run runs/today --concurrency 16
pnpm run generate -- --run runs/today --concurrency 8
```

The resolved value is recorded in `run.json` so every run documents the concurrency it actually used.

## Platform failures are excluded from the score, logged as issues

Generate/platform failures — CLI dispatch errors, non-emission, timeouts — are **not** access-model signal. They are dropped from the metric (`ok=false` cells are excluded from the denominator in `metric.ts`) so they neither inflate nor depress the score. When they recur, log them as GitHub issues with the **`agent-created`** label, linked to #2602. Do not let infrastructure noise drag the metric or get silently swallowed.
