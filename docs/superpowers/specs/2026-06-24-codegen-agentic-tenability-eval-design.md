# Codegen Agentic Tenability Eval — Design

**Date:** 2026-06-24
**Status:** Approved (brainstorm) — pending implementation plan
**Package:** `eval/codegen-agentic` (new)
**Refs:** #2549 (harness-improvement brief), #2552 (stable-network run + per-model data), PR #2635 (structural metrics), PR #2636 (OpenRouter skills)

## 1. Goal

Answer one question: **once we remove the transport, format, and one-shot confounds via a fair tool loop, does the open-weight-vs-closed gap close, and at what real cost per acceptable app?**

The #2552 run measured open-weight models through `vibes-diy generate` (the product path) and found them failing — but the failures were mostly **not capability**: transport drops (gpt-oss-20b 78% generate-failed), parse failures against our bespoke output protocol (mistral-nemo 56% "No files resolved"), and inconsistent protocol adherence with no chance to self-correct (deepseek/qwen emitted `access.js` 22–44% of the time). This eval strips those confounds away and measures what's left: the model's true capability and true cost in a neutral, model-agnostic tool loop.

This is a **measurement**, not a product feature. It does not change the Vibes product.

## 2. The measurement contract

### 2.1 Two modes

Both run through the OpenRouter SDK (`@openrouter/agent`), calling OpenRouter directly — **no vibes API, no `vibes-diy generate`**.

- **one-shot** — a single `callModel` completion. The model emits complete files as fenced code blocks, each preceded by a filename line (`App.jsx`, `access.js`) — the filename convention the vibes prompt already uses, minus SEARCH/REPLACE. The harness parses them.
- **agentic** — `callModel` with a `write_file({path, contents})` tool. The model writes files; the harness runs a build-check + structural-check; failures are fed back; the model fixes and re-emits; repeat until clean or a stop condition fires.

**The only difference between the modes is the feedback loop.** That is the variable under test.

### 2.2 What is held constant (the isolation that makes it valid)

- **Identical task + coding rules prompt** across all models and both modes — the substantive content of the vibes initial system prompt (Fireproof, `use-vibes`, the access model, the app requirements), with the vibes-parser-specific I/O protocol (SEARCH/REPLACE, the ▸ improvement question, the section/block streaming protocol) removed.
- The **I/O mechanism necessarily differs by mode** (parse-prose vs `write_file` tool). That difference *is* the loop variable; it is expected, not a confound.
- **No per-model prompt adaptation.** Every model gets the same prompt. (Per-model prompt adaptation is a separate, later experiment — see §8.)
- Same models, prompts, reps, and per-cell budget everywhere.

### 2.3 Scope

- **Models (8):** open-weight — `deepseek/deepseek-chat-v3.1`, `deepseek/deepseek-v3.2`, `qwen/qwen3-235b-a22b-2507`, `qwen/qwen3-coder-plus` (open family, hosted commercial tier), `mistralai/mistral-nemo`, `openai/gpt-oss-20b`; closed anchors — `google/gemini-3.1-pro-preview` (quality ceiling), `google/gemini-2.5-flash-lite` (cheap-closed value).
- **Prompts (3):** the existing `config/prompts.jsonl` corpus — `collab-lists` (per-list collaborator ACL), `audio-synth` (Web Audio ADSR), `recipe-shop` (callAI structured extraction). Each prompt carries a `needsAccess` boolean (collab-lists `true`; audio-synth, recipe-shop `false` for v1) that the "acceptable" definition reads — see §2.5.
- **Reps:** 3. **Modes:** 2. → **288 cells** (8 × 3 × 3 × 2 = 144 one-shot + 144 agentic).

### 2.4 Metrics per cell

- `feature` — 1–5 LLM judge (reused from `codegen-matrix`).
- `rubric` — 0–1 deterministic adherence ratio (reused).
- structural signals — `hasAccessJs`, `gatesOnCan`, `usesRequireAccess`/`Role`, etc. (reused from PR #2635).
- `buildPass` — does the generated source compile (esbuild transform; see §4.3).
- `steps` — turns to converge (agentic only; one-shot = 1).
- `costUsd` + `tokens` — real per-generation cost (SDK result + `/api/v1/generation`).

### 2.5 "Acceptable app" (the denominator for $/acceptable)

A cell is **acceptable** iff: `buildPass` **AND** `feature ≥ 3` **AND** (only when the prompt's `needsAccess` flag is `true`) `hasAccessJs`. The `feature ≥ 3` bar is configurable in `matrix.json`; `needsAccess` is per-prompt in `prompts.jsonl` (collab-lists `true`, the others `false` for v1).

### 2.6 Headline outputs

1. Per-model **one-shot → agentic delta** on build-pass%, feature, parse/access.js rates — the confound-removal result.
2. **$/acceptable-app** per model × mode — the tenability economics.
3. **Open-vs-closed rollup** — does open+agentic match closed, and at what $/acceptable.

### 2.7 Out of scope (v1)

The visual/design judge, any deploy or screenshot, per-model prompt adaptation, the product `vibes-diy generate` path.

## 3. Architecture

New sibling package `eval/codegen-agentic`, mirroring `eval/codegen-matrix` conventions. The **scoring brain is shared, not duplicated**: `codegen-matrix` promotes its pure modules to a package `exports` surface, and `codegen-agentic` consumes them as a workspace dependency — so scoring is provably identical to the shipped harness.

```
eval/codegen-agentic/
  config/
    matrix.json        # 8 models, reps, judgeModel, stop {maxSteps, maxCostUsd}, budgetUsdTotal, concurrency
    prompts.jsonl      # the same 3 prompts
    system-prompt.md   # shared task+rules (vibes content minus the vibes-parser I/O protocol)
  src/
    client.ts          # @openrouter/agent OpenRouter client; key from env (keychain-fed)
    prompt.ts          # task+rules + per-mode I/O instructions
    parse-files.ts     # pure: filename-fenced blocks -> {path: contents}
    oneshot.ts         # single callModel -> parse-files
    build-check.ts     # pure-ish: esbuild transform of App.jsx/access.js -> {ok, errors[]}
    feedback.ts        # pure: build + structural results -> next-turn feedback message
    agentic.ts         # write_file tool() loop + stop conditions -> {files, steps, transcript}
    cost.ts            # per-generation cost/tokens from SDK result (+ /api/v1/generation)
    generate.ts        # orchestrate cells (model×prompt×rep×mode), write cell.json
    score.ts           # REUSE rubric+structure+feature judge over source; cell.score.json
    report.ts          # per-model×mode aggregation, deltas, $/acceptable -> summary.md + index.jsonl
    config.ts / pool.ts
  runs/                # gitignored
```

### 3.1 Shared-module promotion (implementation step 1)

`codegen-matrix` gains a curated barrel `src/scoring.ts` re-exporting the pure public surface — `runRubric`, `computeStructure`, `judgeFeature`, `readDevVars`, `collectSourceFiles`, and the relevant types (`StructureSignals`, `RubricResult`, `JudgeResult`, `JudgeDeps`) — wired into `package.json` `exports`. `codegen-agentic` declares `@vibes.diy/eval-codegen-matrix` as a `workspace:*` dependency and imports from the barrel. The pure modules are unchanged, so `codegen-matrix`'s existing tests stay green. This is a refactor of shipped code; it belongs on the feature branch, tested and reviewed with the rest.

## 4. Generation

### 4.1 one-shot generator

Build the prompt (task+rules + "emit complete `App.jsx` and `access.js` as filename-fenced blocks") → one `callModel` → `parse-files` → run `build-check` once (recorded, **not** iterated) → done. One generation.

### 4.2 agentic generator

Same task+rules + a `write_file({path, contents})` tool. Per turn: the model writes files → the harness runs `build-check` + `computeStructure` → if failing and under caps, `feedback.ts` returns the specific failures (e.g. "App.jsx: unexpected token at line 12"; "no access.js emitted — this prompt needs per-list permissions") as the tool result → the model fixes → repeat.

**Stop when:** build + structural clean (success) **OR** `stepCountIs(maxSteps)` **OR** `maxCost(maxCostUsd)` per cell. Suggested defaults: `maxSteps = 4`, `maxCostUsd = 0.50` per cell. Record the final files, step count, summed cost across turns, and the full transcript.

Stop conditions come from `@openrouter/agent/stop-conditions` (`stepCountIs`, `maxCost`, `finishReasonIs`); the success stop is the harness's own clean-build-and-structure check.

### 4.3 build-check

An esbuild transform of the JSX/ESM source, with `react`, `use-fireproof`, `use-vibes`, and `call-ai` treated as **external** (not resolved — we check the code parses and references are structurally valid, we do not run it). Catches the syntax/import/parse-fail class that bit the small models, plus a default-export check. This is a structural compile check, **not** the real vibes lint — faithful enough for the parse-fail signal, and noted as such. It does not render the component (source-only, per the loop-fidelity decision).

## 5. Scoring & cost

- `score.ts` reuses the shared exports: `runRubric`, `computeStructure`, `judgeFeature`, `collectSourceFiles`. **No design judge.**
- Each scored cell records: rubric (0–1), feature (1–5), structural signals, `buildPass` and `steps` (carried from generation), and cost.
- Judge transport is the same `.dev.vars`/env `LLM_BACKEND_*` path as `codegen-matrix`, fed the same keychain OpenRouter key (mapped to `LLM_BACKEND_API_KEY` + `LLM_BACKEND_URL=https://openrouter.ai/api/v1`).
- `cost.ts` reads `total_cost` + tokens from the SDK `ModelResult`, optionally enriched via `GET /api/v1/generation` by id. A cell's cost is the sum across the agentic loop's turns (one-shot = one call).

## 6. Report

`summary.md`, four sections:

1. **Per-model × per-mode table** — build-pass%, mean feature, rubric, structural rates, median steps (agentic), mean $/gen.
2. **Delta table (headline)** — per model, one-shot → agentic change in build-pass%, feature, parse/access.js rates. The confound-removal result.
3. **$/acceptable-app** — per model × mode (acceptable per §2.5). The tenability economics.
4. **Open-vs-closed rollup** — does open+agentic match closed (one-shot or agentic) on feature, and at what $/acceptable.

`index.jsonl` — one row per cell: mode, model, prompt, rep, feature, rubric, structural booleans, buildPass, steps, costUsd, tokens.

## 7. Guardrails, error handling, testing

### 7.1 Guardrails (cover the full-set "find out late" risk)

- **Preflight smoke** — 1 model × 1 prompt × both modes before the full run; asserts the key works and the parse → build → score → cost pipeline runs end-to-end; aborts with a clear message on failure.
- **Cost caps** — per-cell `maxCost` (SDK stop condition, default $0.50) is the **hard** per-request cap. The aggregate `budgetUsdTotal` (suggested default ~$50 for the 288-cell run, revisited after the preflight's measured per-cell cost) is a **soft** cap: once reached, no new cell starts, but the ≤`concurrency` cells already in flight finish, so total spend can overshoot by at most `concurrency × maxCostUsd` (~$2 on defaults). A strictly-hard aggregate cap would require cancelling in-flight requests — out of scope for v1. A live cost meter (running + projected $) prints to the run log.
- **Concurrency** — modest (default `concurrency: 4`), since agentic loops are multi-turn and we want cost visible and rate limits respected.

### 7.2 Error handling

- Parse failure (one-shot) or no-files-after-maxSteps (agentic) → recorded as `buildPass: false`, feature scored on whatever exists (or unscored). Data, not a crash.
- build-check errors are data — fed back in agentic mode, recorded in one-shot.
- Null judge → the same `nullJudge > 20%` WARNING as `codegen-matrix`.
- SDK/network errors → bounded retry, then a distinct `errored` cell state (separate from a model failure, which is a result).

### 7.3 Testing

- **Unit (vitest):** `parse-files` (incl. malformed/missing-filename), `build-check` (valid/invalid JSX, bad imports, missing default export), `feedback` (build+structural → message), **agentic loop control** (converge / `maxSteps` / `maxCost` via an injected fake model, mirroring `codegen-matrix`'s `runWithRetries` test), `cost` aggregation, `report` aggregation (delta + $/acceptable).
- **Live smoke:** the preflight 1-cell run validates the real SDK + judge path.
- Shared-module tests remain in `codegen-matrix`, unchanged.
- For type changes, `tsc --noEmit` in addition to vitest (vitest uses esbuild, no type-check).

## 8. Follow-ups (explicitly not in v1)

- **Per-model prompt adaptation** (Condition A/B from the #2549 analysis) — vary the encoding per model and measure the delta.
- **Design dimension** — add deploy + screenshot + design judge for visual fidelity.
- **Promote shared scoring to a standalone `eval/lib`** if a third harness appears.
- **Provider routing** — for open-weight models, compare/pin OpenRouter providers (the `provider_responses` chain).
