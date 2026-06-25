# Codegen-Agentic Harness Hardening — Design

**Date:** 2026-06-24
**Status:** Approved (brainstorm), pending implementation plan
**Package:** [`eval/codegen-agentic`](../../../eval/codegen-agentic) (+ sibling [`eval/codegen-matrix`](../../../eval/codegen-matrix))
**Related:** PR #2638 (the harness itself); the first full-matrix run (`runs/2026-06-25T02-47-11-318Z`) surfaced these issues.

## Problem

The first end-to-end 144-cell run exposed three harness fragilities, all rooted in **unretried transient provider errors**:

1. **Preflight gates the entire sweep on `models[0]`.** `generate.ts` runs a 2-cell smoke (first model, first prompt, both modes) and aborts the whole run if either cell's `exitState === "errored"`. A transient OpenRouter `Upstream idle timeout exceeded` on the first model's agentic route aborted all 144 cells — twice. A flaky provider for one arbitrary model should not block the sweep.

2. **A misconfigured judge silently produces a 100%-null report.** The judge calls `callAi` with `endpoint = LLM_BACKEND_URL`. When that URL omits `/chat/completions`, call-ai POSTs to the wrong path, gets an HTML error page, and the Claude extractor throws — surfaced only as the generic `"judge returned unparseable output"`, with `feature = null` for every cell. The run still exits 0; the only signal is a stderr WARNING emitted _after_ all 91 cells are scored (and billed). The runbook does not document the exact URL, which is how the wrong value crept in.

3. **No retry on the generation calls.** `runOneShot`/`runAgentic` call `client.callModel` with no retry, so a transient timeout becomes an `errored` cell (18 such cells in the run). This is the same root cause as #1, and it understates open-weight build-pass.

## Goals

- A transient provider blip never aborts the sweep, and rarely even errors a cell.
- A misconfigured judge fails **fast and loud**, before wasting a batch of judge calls, with an actionable message.
- Preflight still catches genuine config errors (bad key, bad model id) before spending budget.
- Changes are unit-tested in the harness's existing pure-module style (vitest), and reuse existing primitives.

## Non-goals

- Pinning OpenRouter providers (`provider.require_parameters`) — intentionally left at default routing so the eval keeps measuring real-world open-weight reliability (separate decision, tracked in the PR comment).
- Adding a design/render judge, changing the scoring rubric, or altering the matrix/prompts.
- Reworking the budget model.

## Decisions (from brainstorm)

- **Scope:** all three fixes (both flagged bugs + generate-side retry).
- **Preflight:** classify — retry, then abort **only** on a non-transient error; warn-and-continue on a transient one.
- **Judge:** add a judge preflight smoke + surface the real transport error + document the URL.
- **Retry count:** constant `2` (3 total attempts), optionally overridable via a new optional `maxRetries` field in `matrix.json` (defaults to 2; existing configs stay valid).
- **Cross-package edit into `eval/codegen-matrix` is accepted** (it also fixes codegen-matrix's judge error-surfacing).

## Component 1 — Shared retry on generation calls

Reuse `eval/codegen-matrix/src/backoff.ts` (`isTransientError`, `retryWithBackoff` — already has an injectable `sleep` for tests). These are **not** currently in the package's public surface.

**Changes:**

- `eval/codegen-matrix/src/scoring.ts`: re-export `isTransientError`, `retryWithBackoff`, and the `BackoffOpts` type from `./backoff.js` (the curated barrel is the only package export, `./scoring`).
- `eval/codegen-agentic/src/oneshot.ts` (`runOneShot`): wrap the network-producing body (`callModel` → `getText` → `getResponse` → parse → build) in `retryWithBackoff(fn, { retries, isRetryable: isTransientError })`. Idempotent single call; no state concerns.
- `eval/codegen-agentic/src/agentic.ts` (`runAgentic`): wrap the model call in `retryWithBackoff`, but the retried closure must **re-initialize `files = {}` and `steps = 0` per attempt** (and reconstruct the `write_file` tool over that fresh state), so a partial first attempt cannot double-count tool calls or carry stale files. The final `buildCheck` and result assembly run on whichever attempt succeeds.
- Retry count sourced from `cfg.maxRetries ?? 2`.

**Cost note:** only transient errors are retried, and they fail early (≈$0 spent), so retry cost amplification is negligible. The per-cell `maxCostUsd` SDK cap remains per-attempt — documented, not separately budgeted.

## Component 2 — Preflight aborts only on non-transient errors

**Changes:**

- `eval/codegen-agentic/src/cell.ts`: add `readonly transient?: boolean` to `GenResult`.
- `oneshot.ts` / `agentic.ts` `catch (e)` blocks: set `transient: isTransientError(e)` on the errored return (computed before `e` is stringified into `note`). This reaches the cell only when retries are exhausted.
- `eval/codegen-agentic/src/generate.ts`: extract a pure `shouldAbortPreflight(result: CellResult): boolean` → returns `true` only when `exitState === "errored" && !transient`. The preflight loop calls it; on `true` it throws the existing actionable error, on a transient error it `stderr.write`s a prominent WARNING (`preflight <mode> hit a transient error after retries — continuing; cells may error`) and proceeds. Pure function → unit-tested.

## Component 3 — Judge preflight + honest errors

**Changes (in `eval/codegen-matrix/src/judge.ts`, shared):**

- `parseJudge`: on JSON-parse failure, inspect the raw text. If it looks like HTML (`<!DOCTYPE`/`<html`) or is empty, return a specific reason: `"judge returned non-JSON (HTML/empty) — check LLM_BACKEND_URL includes /chat/completions"`, plus a short (≤120-char) raw snippet. Keeps the `score: null` contract; only the `reason` gets more honest.
- New exported `assertJudgeReachable(deps: JudgeDeps): Promise<void>`: issues one trivial `judgeFeature` call (fixed prompt + a one-line App.jsx). If the result `score === null`, throw `Error` with the actionable message (URL / `/chat/completions`). Otherwise return.
- `eval/codegen-matrix/src/scoring.ts`: export `assertJudgeReachable`.

**Changes (in `eval/codegen-agentic/src/score.ts`):**

- Call `await assertJudgeReachable(deps)` once **before** the cell loop. A misconfig now fails in ~2s with a clear message instead of after 91 null cells.
- Keep the existing `>20%` null WARNING for genuine partial-null runs (judge flaky on hard cells).

## Component 4 — Docs

- `agents/codegen-agentic-eval.md`: in Prerequisites §2, give the exact value `LLM_BACKEND_URL=https://openrouter.ai/api/v1/chat/completions`. Add troubleshooting rows: "100% null judge → URL missing `/chat/completions`" and "preflight warns-and-continues on transient error (only non-transient aborts)".
- `eval/codegen-agentic/README.md`: mirror the URL value and the new preflight/judge-preflight behavior in the relevant sections.

## Testing (vitest, pure-module convention)

- **C1:** retry wrapper behavior — a transient error retries then succeeds; a non-transient error throws immediately (assert attempt counts via injected `sleep`). Agentic state-reset: a fake driver that throws transiently on attempt 1 then writes a file on attempt 2 yields `steps === 1` (not 2) and the single file.
- **C2:** `shouldAbortPreflight` — `{errored, transient:true}` → `false` (continue); `{errored, transient:false}` → `true` (abort); `{ok}` → `false`.
- **C3:** `parseJudge` — HTML input → the `/chat/completions` reason; empty input → same; valid JSON → parsed score. `assertJudgeReachable` is a live path, smoke-tested manually.

## Files touched

| File                                                               | Change                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `eval/codegen-matrix/src/scoring.ts`                               | export `isTransientError`, `retryWithBackoff`, `BackoffOpts`, `assertJudgeReachable` |
| `eval/codegen-matrix/src/judge.ts`                                 | honest `parseJudge` errors; new `assertJudgeReachable`                               |
| `eval/codegen-agentic/src/cell.ts`                                 | add `transient?: boolean` to `GenResult`; `maxRetries?` to `MatrixConfig`            |
| `eval/codegen-agentic/src/oneshot.ts`                              | retry wrap                                                                           |
| `eval/codegen-agentic/src/agentic.ts`                              | retry wrap with per-attempt state reset                                              |
| `eval/codegen-agentic/src/generate.ts`                             | `shouldAbortPreflight` + warn-on-transient                                           |
| `eval/codegen-agentic/src/score.ts`                                | `assertJudgeReachable` preflight                                                     |
| `eval/codegen-agentic/config/matrix.json`                          | optional `maxRetries` (no behavior change at default)                                |
| `agents/codegen-agentic-eval.md`, `eval/codegen-agentic/README.md` | docs                                                                                 |
| `*.test.ts` alongside C1–C3                                        | tests                                                                                |

## Risks

- **Cross-package change** affects `eval/codegen-matrix` (and thus the codegen-matrix eval). `parseJudge`/`assertJudgeReachable` changes are additive and improve both; run codegen-matrix's tests too.
- **Agentic retry state reset** is the subtlest piece — getting it wrong double-counts steps. Covered by a dedicated test.
- **`config.ts` `parseMatrix`** currently requires a fixed key set; `maxRetries` must be **optional** (read via `cfg.maxRetries ?? 2`), not added to the required list, so existing matrices stay valid.

## Rollout

Single PR onto the `eval/codegen-agentic-tenability` branch (PR #2638 is still open and unmerged), so the fixes land with the harness before it reaches main.
