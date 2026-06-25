# Codegen-Agentic Harness Hardening Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the codegen-agentic eval harness resilient to transient provider errors and judge misconfiguration — retry the generation calls, abort preflight only on non-transient errors, and fail the score stage fast-and-loud when the judge URL is wrong.

**Architecture:** Reuse the sibling `eval/codegen-matrix` `backoff.ts` retry primitives (newly exported through the package barrel). Generation runners (`runOneShot`/`runAgentic`) split into a throw-on-error `*Once` inner call wrapped by `retryWithBackoff`, so retry state-reset is structural. Preflight reads a new `transient` flag on the errored result and continues on transient failures. The score stage gains a judge-reachability preflight mirroring the generate preflight.

**Tech Stack:** TypeScript (ESM, `tsx`), vitest, `@openrouter/agent`, `call-ai`, the `@vibes.diy/eval-codegen-matrix/scoring` barrel.

---

## Global Constraints

Binding, cross-cutting requirements every task and reviewer must honor:

- **`parseMatrix` must keep accepting existing matrices.** `maxRetries` is an **optional** `MatrixConfig` field — never add it to the required-key list in `eval/codegen-agentic/src/config.ts`. Read it as `cfg.maxRetries ?? 2`.
- **Reuse, don't reimplement.** Retry/classification uses the existing `isTransientError` + `retryWithBackoff` from `eval/codegen-matrix/src/backoff.ts`. Do not write a second retry loop or a second transient-error matcher.
- **Cross-package edits keep `eval/codegen-matrix` green.** Changes to `judge.ts`/`scoring.ts` are additive; the codegen-matrix test suite must still pass.
- **Default provider routing is intentional.** Do NOT add `provider.require_parameters` / provider pinning — measuring real-world open-weight reliability under default routing is a deliberate non-goal of this change.
- **Judge URL is documented as the full path** `https://openrouter.ai/api/v1/chat/completions` everywhere it appears.
- **Retry only transient errors.** Non-transient errors (4xx, parse) must fail immediately, never retried.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `eval/codegen-agentic/src/cell.ts` | add `transient?` to `GenResult`, `maxRetries?` to `MatrixConfig` | 1 |
| `eval/codegen-matrix/src/judge.ts` | honest `parseJudge` errors; new `assertJudgeReachable` | 2 |
| `eval/codegen-matrix/src/scoring.ts` | export retry primitives + `assertJudgeReachable` | 2 |
| `eval/codegen-agentic/src/oneshot.ts` | `runOneShotOnce` + retry wrap + `transient` flag | 3 |
| `eval/codegen-agentic/src/agentic.ts` | `runAgenticOnce` + retry wrap + `transient` flag | 3 |
| `eval/codegen-agentic/src/generate.ts` | `shouldAbortPreflight`, warn-on-transient, thread `maxRetries` | 3 |
| `eval/codegen-agentic/src/score.ts` | `assertJudgeReachable` preflight before the cell loop | 4 |
| `agents/codegen-agentic-eval.md`, `eval/codegen-agentic/README.md` | document URL + new preflight behavior | 5 |

---

### Task 1: Result/config type additions (contract)

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `eval/codegen-agentic/src/cell.ts`

**Interfaces:**
- Produces: `GenResult.transient?: boolean`, `MatrixConfig.maxRetries?: number` (both optional; `CellResult` inherits `transient` via `extends GenResult`)

- [ ] **Step 1: Add the two optional fields**

In `eval/codegen-agentic/src/cell.ts`, add `maxRetries` to `MatrixConfig` (after `featureAcceptBar`):

```typescript
  readonly featureAcceptBar: number;
  /** Max retries on transient generation errors (total attempts = maxRetries + 1). Defaults to 2 when absent. */
  readonly maxRetries?: number;
  readonly models: readonly ModelEntry[];
```

And add `transient` to `GenResult` (after `note`):

```typescript
  readonly note: string;
  /** Set on an errored result when the underlying error was a transient/retryable infra failure. */
  readonly transient?: boolean;
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json`
Expected: PASS (no errors — both fields are optional, no call sites break).

- [ ] **Step 3: Commit**

```bash
git add eval/codegen-agentic/src/cell.ts
git commit -m "feat(codegen-agentic): add transient flag + optional maxRetries to result/config types"
```

---

### Task 2: Judge hardening + barrel exports (contract)

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `eval/codegen-matrix/src/judge.ts`
- Modify: `eval/codegen-matrix/src/scoring.ts`
- Test: `eval/codegen-matrix/src/judge.test.ts`

**Interfaces:**
- Consumes: `isTransientError`, `retryWithBackoff`, `BackoffOpts` (from existing `./backoff.js`)
- Produces: re-exported `isTransientError`, `retryWithBackoff`, `BackoffOpts`; `assertJudgeReachable(deps: JudgeDeps): Promise<void>`; `parseJudge` that names the URL cause on non-JSON output

**Parallelization rationale:** the barrel is the single shared contract both the generate-side retry (Task 3) and the score preflight (Task 4) consume; fixing it once up front lets those two tasks build against stable exports in parallel.

- [ ] **Step 1: Write the failing test for honest parseJudge errors**

`parseJudge` is currently module-private. Export it for testing and add cases. In `eval/codegen-matrix/src/judge.test.ts`, add:

```typescript
import { parseJudge } from "./judge.js";

describe("parseJudge", () => {
  it("names the /chat/completions cause when the body is HTML", () => {
    const r = parseJudge("<!DOCTYPE html>\n<html><body>Not Found</body></html>");
    expect(r.score).toBeNull();
    expect(r.reason).toMatch(/chat\/completions/);
  });
  it("names the cause when the body is empty", () => {
    const r = parseJudge("");
    expect(r.score).toBeNull();
    expect(r.reason).toMatch(/chat\/completions/);
  });
  it("parses a well-formed judge object", () => {
    const r = parseJudge(`{"score":4,"reason":"good"}`);
    expect(r.score).toBe(4);
    expect(r.reason).toBe("good");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/judge.test.ts`
Expected: FAIL — `parseJudge` is not exported / HTML case returns the generic "unparseable output" reason.

- [ ] **Step 3: Make parseJudge honest and exported**

In `eval/codegen-matrix/src/judge.ts`, replace the `parseJudge` function with:

```typescript
export function parseJudge(raw: unknown): { score: number | null; reason: string } {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    const obj = JSON.parse(text) as { score?: unknown; reason?: unknown };
    return { score: clampScore(obj.score), reason: typeof obj.reason === "string" ? obj.reason : "" };
  } catch {
    const trimmed = text.trim();
    const looksHtml = /^<(!doctype|html)/i.test(trimmed);
    const hint =
      looksHtml || trimmed.length === 0
        ? "judge returned non-JSON (HTML/empty) — check LLM_BACKEND_URL includes /chat/completions"
        : `judge returned unparseable output: ${trimmed.slice(0, 120)}`;
    return { score: null, reason: hint };
  }
}
```

- [ ] **Step 4: Run the parseJudge tests to verify they pass**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/judge.test.ts`
Expected: PASS.

- [ ] **Step 5: Add assertJudgeReachable**

In `eval/codegen-matrix/src/judge.ts`, after `judgeFeature`, add:

```typescript
/**
 * One trivial judge call to confirm the transport is reachable and returns
 * parseable JSON. Throws an actionable error if the judge yields a null score
 * (e.g. LLM_BACKEND_URL missing /chat/completions) so the score stage can fail
 * fast instead of producing an all-null report.
 */
export async function assertJudgeReachable(deps: JudgeDeps): Promise<void> {
  const probe = await judgeFeature(
    "Score whether the app fulfils 'hello world'.",
    { "App.jsx": "export default () => <h1>hi</h1>;" },
    deps
  );
  if (probe.score === null) {
    throw new Error(
      `judge preflight failed (${probe.reason}). Check LLM_BACKEND_URL (needs the full ` +
        `https://openrouter.ai/api/v1/chat/completions path) and LLM_BACKEND_API_KEY.`
    );
  }
}
```

- [ ] **Step 6: Export the new + reused symbols from the barrel**

In `eval/codegen-matrix/src/scoring.ts`, add:

```typescript
export { judgeFeature, readDevVars, assertJudgeReachable } from "./judge.js";
export { isTransientError, retryWithBackoff } from "./backoff.js";
export type { BackoffOpts } from "./backoff.js";
```

(Replace the existing `export { judgeFeature, readDevVars } from "./judge.js";` line with the first line above.)

- [ ] **Step 7: Type-check + run the matrix suite**

Run: `pnpm exec tsc --noEmit -p eval/codegen-matrix/tsconfig.json && pnpm exec vitest --run --project eval-codegen-matrix`
Expected: PASS (additive changes; existing tests still green).

- [ ] **Step 8: Commit**

```bash
git add eval/codegen-matrix/src/judge.ts eval/codegen-matrix/src/scoring.ts eval/codegen-matrix/src/judge.test.ts
git commit -m "feat(codegen-matrix): honest judge parse errors, assertJudgeReachable, export retry primitives"
```

---

### Task 3: Generate-side retry + preflight classification

**Type:** implementation
**Depends-on:** 1, 2

**Files:**
- Modify: `eval/codegen-agentic/src/oneshot.ts`
- Modify: `eval/codegen-agentic/src/agentic.ts`
- Modify: `eval/codegen-agentic/src/generate.ts`
- Test: `eval/codegen-agentic/src/oneshot.test.ts` (new)
- Test: `eval/codegen-agentic/src/generate.test.ts` (new)

**Interfaces:**
- Consumes: `GenResult.transient`, `MatrixConfig.maxRetries` (from Task 1); `isTransientError`, `retryWithBackoff` (from Task 2 barrel)
- Produces: `shouldAbortPreflight(r: { exitState: string; transient?: boolean }): boolean`; `runOneShot`/`runAgentic` now retry transient errors and set `transient` on exhausted-error results

**Parallelization rationale:** `oneshot.ts`, `agentic.ts`, and `generate.ts` form one call-graph unit (the runners' signatures and their `runJob` call sites move together), so they belong in a single worktree-pure task rather than split across waves where they would collide on `generate.ts`.

- [ ] **Step 1: Write the failing test for one-shot retry + classification**

Create `eval/codegen-agentic/src/oneshot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { runOneShot } from "./oneshot.js";

// Minimal fake OpenRouter client: getText() yields `texts[call]`, or throws if it is an Error.
function fakeClient(texts: Array<string | Error>) {
  let call = 0;
  return {
    callModel() {
      const v = texts[call++];
      return {
        async getText() {
          if (v instanceof Error) throw v;
          return v;
        },
        async getResponse() {
          return { totalCost: 0 };
        },
      };
    },
  } as never;
}

const SYS = "system";
const APP = "```App.jsx\nimport React from 'react';\nexport default function App(){ return <div/>; }\n```";

describe("runOneShot retry", () => {
  it("retries a transient error then succeeds", async () => {
    const client = fakeClient([new Error("503 Service Unavailable"), APP]);
    const r = await runOneShot(client, "m", SYS, "p", 2);
    expect(r.exitState).toBe("ok");
  });
  it("does not retry a non-transient error and marks it non-transient", async () => {
    const client = fakeClient([new Error("400 Bad Request")]);
    const r = await runOneShot(client, "m", SYS, "p", 2);
    expect(r.exitState).toBe("errored");
    expect(r.transient).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-agentic src/oneshot.test.ts`
Expected: FAIL — `runOneShot` has arity 4 (no `retries` param) and does not retry.

- [ ] **Step 3: Split runOneShot into a throwing inner call + retry wrapper**

Replace the body of `eval/codegen-agentic/src/oneshot.ts` with:

```typescript
import type { OpenRouter } from "@openrouter/agent";
import { isTransientError, retryWithBackoff } from "@vibes.diy/eval-codegen-matrix/scoring";
import type { GenResult } from "./cell.js";
import { buildPrompt } from "./prompt.js";
import { parseFiles } from "./parse-files.js";
import { buildCheck } from "./build-check.js";
import { extractCost } from "./cost.js";

/** One completion attempt. Throws on a network/SDK error so the caller can retry. */
async function runOneShotOnce(client: OpenRouter, model: string, systemPrompt: string, userPrompt: string): Promise<GenResult> {
  const { instructions, input } = buildPrompt("oneshot", systemPrompt, userPrompt);
  const result = client.callModel({ model, instructions, input });
  const text = await result.getText();
  const response = await result.getResponse();
  const { costUsd, tokens } = extractCost(response as never);
  const files = parseFiles(text);
  if (Object.keys(files).length === 0) {
    return { files, steps: 1, buildPass: false, costUsd, tokens, exitState: "no-files", note: "no files parsed from output" };
  }
  const build = await buildCheck(files);
  return { files, steps: 1, buildPass: build.ok, costUsd, tokens, exitState: "ok", note: build.ok ? "" : build.errors.join("; ") };
}

/** One completion, with transient-error retry. `retries` defaults to 2 (3 attempts). */
export async function runOneShot(client: OpenRouter, model: string, systemPrompt: string, userPrompt: string, retries = 2): Promise<GenResult> {
  try {
    return await retryWithBackoff(() => runOneShotOnce(client, model, systemPrompt, userPrompt), { retries, isRetryable: isTransientError });
  } catch (e) {
    return { files: {}, steps: 1, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200), transient: isTransientError(e) };
  }
}
```

- [ ] **Step 4: Run the one-shot tests to verify they pass**

Run: `pnpm exec vitest --run --project eval-codegen-agentic src/oneshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Split runAgentic into a throwing inner call + retry wrapper**

In `eval/codegen-agentic/src/agentic.ts`: add the import, and restructure `runAgentic` so all per-attempt state (`files`, `steps`, the tool) lives inside a `runAgenticOnce` that throws on error; the exported `runAgentic` wraps it with retry and classifies on exhaustion. Add to the imports at the top:

```typescript
import { isTransientError, retryWithBackoff } from "@vibes.diy/eval-codegen-matrix/scoring";
```

Replace the exported `runAgentic` function with:

```typescript
async function runAgenticOnce(
  client: OpenRouter,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxSteps: number; maxCostUsd: number; needsAccess: boolean }
): Promise<GenResult> {
  const files: Record<string, string> = {};
  let steps = 0;
  const exec = makeWriteFileExecutor(files, () => opts.needsAccess);
  const writeFileConfig = {
    name: "write_file",
    description: "Write a complete file (App.jsx or access.js). Returns a build + structural check; fix problems by calling again.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    execute: async (args: { path: string; contents: string }) => {
      steps++;
      return exec(args);
    },
  };
  const writeFile = tool(writeFileConfig as unknown as Parameters<typeof tool>[0]);
  const { instructions, input } = buildPrompt("agentic", systemPrompt, userPrompt);
  const result = client.callModel({
    model,
    instructions,
    input,
    tools: [writeFile],
    stopWhen: [stepCountIs(opts.maxSteps), maxCost(opts.maxCostUsd)],
  });
  await result.getText();
  const response = await result.getResponse();
  const { costUsd, tokens } = extractCost(response as never);
  if (Object.keys(files).length === 0) {
    return { files, steps, buildPass: false, costUsd, tokens, exitState: "no-files", note: "model wrote no files" };
  }
  const build = await buildCheck(files);
  return { files, steps, buildPass: build.ok, costUsd, tokens, exitState: "ok", note: build.ok ? "" : build.errors.join("; ") };
}

export async function runAgentic(
  client: OpenRouter,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxSteps: number; maxCostUsd: number; needsAccess: boolean; retries?: number }
): Promise<GenResult> {
  try {
    return await retryWithBackoff(() => runAgenticOnce(client, model, systemPrompt, userPrompt, opts), {
      retries: opts.retries ?? 2,
      isRetryable: isTransientError,
    });
  } catch (e) {
    return { files: {}, steps: 0, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200), transient: isTransientError(e) };
  }
}
```

Note: a fresh `files`/`steps` is created on every `runAgenticOnce` call, so a retried attempt never inherits a partial first attempt's state.

- [ ] **Step 6: Add the preflight-classification failing test**

Create `eval/codegen-agentic/src/generate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { shouldAbortPreflight } from "./generate.js";

describe("shouldAbortPreflight", () => {
  it("aborts on a non-transient errored smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "errored", transient: false })).toBe(true);
  });
  it("continues on a transient errored smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "errored", transient: true })).toBe(false);
  });
  it("continues on a successful smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "ok" })).toBe(false);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-agentic src/generate.test.ts`
Expected: FAIL — `shouldAbortPreflight` is not exported from `generate.ts`.

- [ ] **Step 8: Add shouldAbortPreflight, thread maxRetries, and warn-on-transient in generate.ts**

In `eval/codegen-agentic/src/generate.ts`, add the pure helper near the top (after imports):

```typescript
/** Preflight aborts the sweep only on a NON-transient errored smoke cell. */
export function shouldAbortPreflight(r: { exitState: string; transient?: boolean }): boolean {
  return r.exitState === "errored" && !r.transient;
}
```

In `runJob`, thread the retry budget into both runners (the `gen` assignment):

```typescript
  const gen =
    job.mode === "oneshot"
      ? await runOneShot(client, job.model, systemPrompt, job.prompt.prompt, cfg.maxRetries ?? 2)
      : await runAgentic(client, job.model, systemPrompt, job.prompt.prompt, {
          maxSteps: cfg.maxSteps,
          maxCostUsd: cfg.maxCostUsd,
          needsAccess: job.prompt.needsAccess,
          retries: cfg.maxRetries ?? 2,
        });
```

Replace the preflight loop body so it classifies instead of aborting on any error:

```typescript
  const smokeModel = cfg.models[0];
  for (const mode of cfg.modes) {
    const r = await runJob(client, cfg, systemPrompt, { model: smokeModel.id, openWeight: smokeModel.openWeight, prompt: prompts[0], rep: 0, mode }, runDir);
    if (shouldAbortPreflight(r)) throw new Error(`preflight ${mode} errored (non-transient): ${r.note}`);
    if (r.exitState === "errored") stderr.write(`preflight ${mode} hit a transient error after retries — continuing; sweep cells may error.\n`);
  }
  stderr.write(`preflight ok. proceeding to full sweep.\n`);
```

- [ ] **Step 9: Run the full codegen-agentic suite**

Run: `pnpm exec vitest --run --project eval-codegen-agentic && pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json`
Expected: PASS (new tests green; existing `agentic.test.ts` for `makeWriteFileExecutor` unaffected).

- [ ] **Step 10: Commit**

```bash
git add eval/codegen-agentic/src/oneshot.ts eval/codegen-agentic/src/agentic.ts eval/codegen-agentic/src/generate.ts eval/codegen-agentic/src/oneshot.test.ts eval/codegen-agentic/src/generate.test.ts
git commit -m "feat(codegen-agentic): retry transient generation errors; preflight aborts only on non-transient"
```

---

### Task 4: Judge preflight in the score stage

**Type:** implementation
**Depends-on:** 2

**Files:**
- Modify: `eval/codegen-agentic/src/score.ts`

**Interfaces:**
- Consumes: `assertJudgeReachable(deps: JudgeDeps): Promise<void>` (from Task 2 barrel)

- [ ] **Step 1: Import assertJudgeReachable**

In `eval/codegen-agentic/src/score.ts`, add `assertJudgeReachable` to the existing barrel import:

```typescript
import { runRubric, computeStructure, judgeFeature, readDevVars, collectSourceFiles, assertJudgeReachable, type JudgeDeps } from "@vibes.diy/eval-codegen-matrix/scoring";
```

- [ ] **Step 2: Call it before the cell loop**

In `main()`, immediately after the `deps` assignment and before `const cellDirs = ...`, add:

```typescript
  await assertJudgeReachable(deps);
  stderr.write(`judge preflight ok (${deps.judgeModel}).\n`);
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Manual smoke — wrong URL fails fast**

Run (deliberately wrong URL, no `/chat/completions`):
`cd eval/codegen-agentic && LLM_BACKEND_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" LLM_BACKEND_URL="https://openrouter.ai/api/v1" pnpm run score 2>&1 | head -5`
Expected: exits non-zero within seconds with `judge preflight failed (... /chat/completions ...)` — NOT an all-null scoring pass.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/score.ts
git commit -m "feat(codegen-agentic): judge-reachability preflight before scoring"
```

---

### Task 5: Documentation

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `agents/codegen-agentic-eval.md`
- Modify: `eval/codegen-agentic/README.md`

- [ ] **Step 1: Document the exact judge URL in the runbook**

In `agents/codegen-agentic-eval.md`, Prerequisites §2 ("Judge transport"), add the explicit value and a note:

```markdown
   Set the FULL chat-completions path (call-ai posts to it verbatim):
   `LLM_BACKEND_URL=https://openrouter.ai/api/v1/chat/completions`
   A bare `.../api/v1` (no `/chat/completions`) makes the judge hit an HTML error
   page → 100% null feature scores. The score stage now preflights the judge and
   fails fast if the URL is wrong.
```

- [ ] **Step 2: Add troubleshooting rows**

In the Troubleshooting table of `agents/codegen-agentic-eval.md`, add:

```markdown
| `judge preflight failed` on `score` | `LLM_BACKEND_URL` is missing `/chat/completions`. Use the full path. |
| Preflight logs "transient error after retries — continuing" | A smoke-model provider blip; the sweep proceeds. Only a non-transient error (bad key / model id) aborts. |
```

- [ ] **Step 3: Mirror in the README**

In `eval/codegen-agentic/README.md`, update the score-stage / judge-transport description to state the full `…/api/v1/chat/completions` URL, and the "Behavior to know" section to note: generation calls retry transient errors (`maxRetries`, default 2); preflight aborts only on non-transient errors; the score stage preflights the judge.

- [ ] **Step 4: Commit**

```bash
git add agents/codegen-agentic-eval.md eval/codegen-agentic/README.md
git commit -m "docs(codegen-agentic): document full judge URL, retry + preflight behavior"
```

---

### Task 6: Full verification gate

**Type:** gate
**Depends-on:** 3, 4, 5

Verification only — runs both eval projects' suites, type-checks, and lint. Writes nothing.

Run: `pnpm exec vitest --run --project eval-codegen-agentic --project eval-codegen-matrix && pnpm exec tsc --noEmit -p eval/codegen-agentic/tsconfig.json && pnpm exec tsc --noEmit -p eval/codegen-matrix/tsconfig.json`
Expected: all green.

(Optionally the full `pnpm check` if touching shared lint config.)

---

## Acceptance

**Acceptance:** suite — internal eval-harness tooling whose diffs the operator reviews on PR #2638. Verification is the committed vitest unit tests (`parseJudge` HTML/empty cases, `runOneShot` retry/classification, `shouldAbortPreflight`), the existing `eval-codegen-matrix` + `eval-codegen-agentic` suites staying green, `tsc`, and the two manual judge-preflight smokes (wrong-URL fails fast; correct-URL scores). No held-out sealed exam — the operator can read every change.

---

## Self-Review

**Spec coverage:** C1 retry → Task 3 (oneshot/agentic) + Task 2 (exports) + Task 1 (`maxRetries`). C2 preflight classification → Task 3 (`shouldAbortPreflight`, `transient` flag) + Task 1 (`transient` type). C3 judge preflight + honest errors → Task 2. C4 docs → Task 5. Generate-side retry (scope item 3) → Task 3. All covered.

**Placeholder scan:** every code step shows full code; no TBD/TODO; test code is concrete.

**Type consistency:** `transient?: boolean` defined in Task 1, set in Task 3, read by `shouldAbortPreflight` in Task 3; `maxRetries?` defined in Task 1, read as `cfg.maxRetries ?? 2` in Task 3; `assertJudgeReachable(deps)` produced in Task 2, consumed in Task 4; `runOneShot(..., retries = 2)` and `runAgentic(..., {retries})` signatures match their call sites in Task 3's `runJob`.

**Dependency audit:** Task 3 `Consumes` Task 1 types + Task 2 barrel → `Depends-on: 1, 2` ✓. Task 4 `Consumes` Task 2 → `Depends-on: 2` ✓. Tasks 1, 2, 5 independent. No two same-wave tasks modify the same file (Task 1=cell.ts, Task 2=judge/scoring, Task 5=docs in wave 1; Task 3=oneshot/agentic/generate, Task 4=score in wave 2).
