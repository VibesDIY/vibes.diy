# Codegen Agentic Tenability Eval — Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `eval/codegen-agentic` — a two-mode (one-shot vs agentic tool-loop) cross-model eval that isolates the loop variable to test whether open-weight models become tenable once transport/format/one-shot confounds are removed, and at what real cost per acceptable app.

**Architecture:** New sibling package to `eval/codegen-matrix`. Both modes call OpenRouter directly via `@openrouter/agent` (no vibes API). Scoring is reused from `codegen-matrix` through a promoted package-`exports` barrel. Generation is source-only: an esbuild build-check + the reused structural metrics provide the agentic loop's feedback; final judging is feature + rubric + structural from source. No deploy, no screenshot.

**Tech Stack:** TypeScript (ESM), `tsx`, `vitest`, `@openrouter/agent` (callModel/tool/stop-conditions), `zod` (tool input schema), `esbuild` (build-check), reused `@vibes.diy/eval-codegen-matrix` scoring.

**Acceptance:** suite — eval-harness feature work; the operator reviews every diff, and the committed `vitest` suite + `tsc --noEmit` are the verification (no held-out exam needed). See spec: `docs/superpowers/specs/2026-06-24-codegen-agentic-tenability-eval-design.md`.

---

## Global Constraints

Forward these to every reviewer as the attention lens. They are binding, cross-cutting requirements from the spec:

1. **No vibes path.** Both modes call OpenRouter directly via `@openrouter/agent`. Never invoke `vibes-diy generate`, the vibes API, or any deploy/screenshot.
2. **Prompt held constant.** All models and both modes use the same task+rules system prompt (`config/system-prompt.md`). The I/O instructions differ by mode (parse-prose vs `write_file` tool) — that is the only intended difference. **No per-model prompt adaptation.**
3. **Source-only judging.** Final score = feature judge + rubric + structural signals over source. No design/visual judge.
4. **Reuse, don't reimplement.** `runRubric`, `computeStructure`, `judgeFeature`, `readDevVars`, `collectSourceFiles` come from `@vibes.diy/eval-codegen-matrix/scoring`. Do not copy or re-derive them.
5. **Secrets.** The OpenRouter key is read from `process.env.OPENROUTER_API_KEY` only. Never write the key to disk, logs, `cell.json`, or the transcript.
6. **Cost caps are hard.** Per-cell `maxCost` (SDK stop condition) and an aggregate `budgetUsdTotal` that halts the run. Costs are USD.
7. **`runs/` is gitignored.** Artifacts never get committed.
8. **Conventions.** Match `eval/codegen-matrix`: ESM `.js` import specifiers in TS, `tsx` scripts, vitest `src/**/*.test.ts`, pure logic unit-tested, `import.meta.url === process.argv[1]` main guards.

---

### Task 1: Promote codegen-matrix scoring to a package export

**Type:** implementation
**Depends-on:** none

**Files:**
- Create: `eval/codegen-matrix/src/scoring.ts`
- Modify: `eval/codegen-matrix/package.json`

**Interfaces:**
- Produces: module specifier `@vibes.diy/eval-codegen-matrix/scoring` re-exporting `runRubric(files)`, `computeStructure(files): StructureSignals`, `judgeFeature(userPrompt, files, deps): Promise<JudgeResult>`, `readDevVars(): DevVars`, `collectSourceFiles(dir): Record<string,string>`, and types `StructureSignals`, `RubricResult`, `JudgeResult`, `JudgeDeps`, `DevVars`.

**Parallelization rationale:** front-loaded contract — `score`, `feedback`, and `agentic` all consume these symbols; fixing the import surface up front lets those tasks build in parallel against a stable barrel instead of reaching into sibling internals.

- [ ] **Step 1: Write the barrel**

Create `eval/codegen-matrix/src/scoring.ts`:

```ts
// Public scoring surface reused by sibling eval harnesses. Keep this curated —
// it is the package's exported API, not an internal grab-bag.
export { runRubric } from "./rubric.js";
export { computeStructure } from "./structure.js";
export { judgeFeature, readDevVars } from "./judge.js";
export { collectSourceFiles } from "./score.js";
export type { StructureSignals } from "./structure.js";
export type { RubricResult, JudgeResult } from "./cell.js";
export type { JudgeDeps, DevVars } from "./judge.js";
```

- [ ] **Step 2: Verify the re-exported symbols exist**

Run: `cd eval/codegen-matrix && rg -n "export function collectSourceFiles|export function runRubric|export function computeStructure|export function judgeFeature|export function readDevVars|export interface JudgeDeps|export interface DevVars" src/`
Expected: a match for each. If `DevVars` is not exported from `judge.ts`, add `export` to its declaration there.

- [ ] **Step 3: Add the exports map to package.json**

In `eval/codegen-matrix/package.json`, add a top-level `"exports"` key (keep `"type": "module"`):

```json
  "exports": {
    "./scoring": "./src/scoring.ts"
  },
```

- [ ] **Step 4: Run codegen-matrix tests (unchanged, still green)**

Run: `cd eval/codegen-matrix && pnpm test`
Expected: PASS (66+ tests). The pure modules are untouched.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/scoring.ts eval/codegen-matrix/package.json
git commit -m "refactor(codegen-matrix): expose scoring barrel via package exports"
```

---

### Task 2: Scaffold the eval/codegen-agentic package + shared types + config

**Type:** implementation
**Depends-on:** none

**Files:**
- Create: `eval/codegen-agentic/package.json`, `eval/codegen-agentic/tsconfig.json`, `eval/codegen-agentic/vitest.config.ts`, `eval/codegen-agentic/runs/.gitignore`, `eval/codegen-agentic/src/cell.ts`, `eval/codegen-agentic/config/matrix.json`, `eval/codegen-agentic/config/prompts.jsonl`, `eval/codegen-agentic/config/system-prompt.md`
- Modify: `pnpm-workspace.yaml`, `vitest.config.ts`

**Interfaces:**
- Produces: types `ModeName = "oneshot" | "agentic"`, `ModelEntry`, `PromptEntry` (with `needsAccess: boolean`), `MatrixConfig`, `GenResult`, `CellResult`, `CellScore`, and constant `CELL_JSON`/`CELL_SCORE_JSON`/`RUN_JSON`; plus `cellDirName(promptId, model, rep, mode)` and `modelSlug(model)`.

**Parallelization rationale:** contract-first — every pure module (parse-files, build-check, prompt, cost, config, report) imports these result/config types; defining them in one early task lets all six build concurrently against a fixed contract.

- [ ] **Step 1: Add the package to the workspace**

In `pnpm-workspace.yaml`, in the `packages:` list next to the other `eval/*` entries, add:

```yaml
  - "eval/codegen-agentic"
```

In `vitest.config.ts`, add to the `projects` array (next to `"eval/codegen-matrix/vitest.config.ts"`):

```ts
      "eval/codegen-agentic/vitest.config.ts",
```

- [ ] **Step 2: Create package manifest, tsconfig, vitest config, gitignore**

`eval/codegen-agentic/package.json`:

```json
{
  "name": "@vibes.diy/eval-codegen-agentic",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Two-mode (one-shot vs agentic) cross-model codegen eval: isolates the tool-loop to measure open-weight tenability and real cost.",
  "scripts": {
    "generate": "tsx src/generate.ts",
    "score": "tsx src/score.ts",
    "report": "tsx src/report.ts",
    "test": "vitest --run"
  },
  "dependencies": {
    "@vibes.diy/eval-codegen-matrix": "workspace:*",
    "@openrouter/agent": "^0.1.0",
    "esbuild": "^0.25.0",
    "zod": "^3.23.0",
    "tsx": "^4.22.4"
  }
}
```

`eval/codegen-agentic/tsconfig.json`:

```json
{
  "extends": "../codegen-matrix/tsconfig.json",
  "include": ["src/**/*.ts"]
}
```

`eval/codegen-agentic/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval-codegen-agentic",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/runs/**"],
  },
});
```

`eval/codegen-agentic/runs/.gitignore`:

```
*
!.gitignore
```

- [ ] **Step 3: Write the shared types**

`eval/codegen-agentic/src/cell.ts`:

```ts
import type { StructureSignals, RubricResult, JudgeResult } from "@vibes.diy/eval-codegen-matrix/scoring";

export type ModeName = "oneshot" | "agentic";

export interface ModelEntry {
  readonly id: string;
  readonly openWeight: boolean;
}
export interface PromptEntry {
  readonly id: string;
  readonly prompt: string;
  /** Acceptability requires a separate access.js only when this is true. */
  readonly needsAccess: boolean;
}
export interface MatrixConfig {
  readonly judgeModel: string;
  readonly reps: number;
  readonly modes: readonly ModeName[];
  readonly concurrency: number;
  readonly maxSteps: number;
  readonly maxCostUsd: number;
  readonly budgetUsdTotal: number;
  readonly featureAcceptBar: number;
  readonly models: readonly ModelEntry[];
}

/** Output of a generator (oneshot or agentic) before scoring. */
export interface GenResult {
  readonly files: Record<string, string>;
  readonly steps: number;
  readonly buildPass: boolean;
  readonly costUsd: number;
  readonly tokens: number;
  readonly exitState: "ok" | "no-files" | "errored";
  readonly note: string;
}

export interface CellResult extends GenResult {
  readonly promptId: string;
  readonly model: string;
  readonly mode: ModeName;
  readonly rep: number;
  readonly openWeight: boolean;
  readonly needsAccess: boolean;
}

export interface CellScore {
  readonly promptId: string;
  readonly model: string;
  readonly mode: ModeName;
  readonly rep: number;
  readonly rubric: RubricResult;
  readonly feature: JudgeResult;
  readonly structure: StructureSignals;
}

export const CELL_JSON = "cell.json";
export const CELL_SCORE_JSON = "cell.score.json";
export const RUN_JSON = "run.json";

export function modelSlug(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function cellDirName(promptId: string, model: string, rep: number, mode: ModeName): string {
  return `${promptId}__${modelSlug(model)}__r${rep}__${mode}`;
}
```

- [ ] **Step 4: Create the config files**

`eval/codegen-agentic/config/matrix.json`:

```json
{
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 3,
  "modes": ["oneshot", "agentic"],
  "concurrency": 4,
  "maxSteps": 4,
  "maxCostUsd": 0.5,
  "budgetUsdTotal": 50,
  "featureAcceptBar": 3,
  "models": [
    { "id": "deepseek/deepseek-chat-v3.1", "openWeight": true },
    { "id": "deepseek/deepseek-v3.2", "openWeight": true },
    { "id": "qwen/qwen3-235b-a22b-2507", "openWeight": true },
    { "id": "qwen/qwen3-coder-plus", "openWeight": true },
    { "id": "mistralai/mistral-nemo", "openWeight": true },
    { "id": "openai/gpt-oss-20b", "openWeight": true },
    { "id": "google/gemini-3.1-pro-preview", "openWeight": false },
    { "id": "google/gemini-2.5-flash-lite", "openWeight": false }
  ]
}
```

`eval/codegen-agentic/config/prompts.jsonl` (copy the three prompt texts verbatim from `eval/codegen-matrix/config/prompts.jsonl`, adding `needsAccess`):

```
{"id":"collab-lists","needsAccess":true,"prompt":"Multi-list todo app. A list creator sees only their own lists and can invite collaborators per list; invited collaborators see only the lists shared with them. Persist lists, items, and per-list membership in Fireproof."}
{"id":"audio-synth","needsAccess":false,"prompt":"Web Audio synthesizer with a playable keyboard and an ADSR envelope (attack/decay/sustain/release sliders) that shapes each note. No external audio libraries."}
{"id":"recipe-shop","needsAccess":false,"prompt":"Recipe to smart shopping list. Enter a recipe; use callAI with a JSON schema to extract ingredients into structured docs; tapping an item toggles 'have it' with optimistic Fireproof writes and a per-row saving cue; a button uses callAI to suggest substitutions."}
```

`eval/codegen-agentic/config/system-prompt.md`: copy the **task + coding rules** content of `prompts/pkg/system-prompt-initial.md` (the Fireproof / use-vibes / callAI / access-model rules and the app-quality rules), but **omit** the vibes-parser I/O protocol — i.e. drop the "Output format (colored shell → access.js → working app)" section, the SEARCH/REPLACE edit instructions, the `▸` improvement-question protocol, and the `{{TEMPLATE}}` placeholders. End it with a neutral instruction: "Produce a complete, working `App.jsx`. If the app needs per-document write validation or channel-based read isolation, also produce a separate `access.js`."

- [ ] **Step 5: Install + verify the workspace resolves**

Run: `pnpm install`
Then: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no type errors (the `@vibes.diy/eval-codegen-matrix/scoring` import resolves via Task 1's exports).

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml vitest.config.ts eval/codegen-agentic pnpm-lock.yaml
git commit -m "feat(codegen-agentic): scaffold package, shared types, config"
```

---

### Task 3: parse-files (one-shot output parser)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/parse-files.ts`, `eval/codegen-agentic/src/parse-files.test.ts`

**Interfaces:**
- Produces: `parseFiles(text: string): Record<string, string>`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/parse-files.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFiles } from "./parse-files.js";

describe("parseFiles", () => {
  it("extracts a filename-fenced block", () => {
    const text = "Here is the app.\n\nApp.jsx\n```jsx\nexport default function App(){return null;}\n```\n";
    expect(parseFiles(text)).toEqual({ "App.jsx": "export default function App(){return null;}" });
  });
  it("extracts multiple files", () => {
    const text = "App.jsx\n```jsx\nA\n```\naccess.js\n```js\nB\n```\n";
    expect(parseFiles(text)).toEqual({ "App.jsx": "A", "access.js": "B" });
  });
  it("returns {} when no filename-fenced block is present", () => {
    expect(parseFiles("just prose, no code")).toEqual({});
  });
  it("ignores a fenced block with no preceding filename line", () => {
    expect(parseFiles("```jsx\norphan\n```")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/parse-files.test.ts`
Expected: FAIL ("parseFiles is not a function" / module not found).

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/parse-files.ts`:

```ts
/**
 * Parse one-shot output: each code file is a fenced block immediately preceded
 * by a line that is just its filename (App.jsx / access.js). Mirrors the vibes
 * prompt's "filename on its own line before each block" convention, minus
 * SEARCH/REPLACE. A fence with no filename line is ignored.
 */
const FILENAME_RE = /^[\w./-]+\.(?:jsx?|tsx?|css|js)$/;

export function parseFiles(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i].trim();
    if (!FILENAME_RE.test(name)) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j >= lines.length || !lines[j].trimStart().startsWith("```")) continue;
    const body: string[] = [];
    let k = j + 1;
    for (; k < lines.length; k++) {
      if (lines[k].trimStart().startsWith("```")) break;
      body.push(lines[k]);
    }
    out[name] = body.join("\n").trim();
    i = k;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/parse-files.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/parse-files.ts eval/codegen-agentic/src/parse-files.test.ts
git commit -m "feat(codegen-agentic): one-shot filename-fenced file parser"
```

---

### Task 4: build-check (esbuild compile gate)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/build-check.ts`, `eval/codegen-agentic/src/build-check.test.ts`

**Interfaces:**
- Produces: `buildCheck(files: Record<string,string>): Promise<{ ok: boolean; errors: string[] }>`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/build-check.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCheck } from "./build-check.js";

describe("buildCheck", () => {
  it("passes valid JSX with a default export", async () => {
    const files = { "App.jsx": `import React from "react";\nexport default function App(){ return <div>hi</div>; }` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("fails on a syntax error and reports it", async () => {
    const files = { "App.jsx": `export default function App(){ return <div>;` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/App\.jsx/);
  });
  it("fails when App.jsx has no default export", async () => {
    const files = { "App.jsx": `import React from "react";\nfunction App(){ return null; }` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/default export/i);
  });
  it("fails when App.jsx is absent", async () => {
    expect((await buildCheck({})).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/build-check.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/build-check.ts`:

```ts
import { transform } from "esbuild";

/**
 * Structural compile gate: transform each source file as JSX/ESM with all bare
 * imports (react, use-fireproof, use-vibes, call-ai, …) treated as external —
 * we check the code PARSES and references resolve structurally, we do not run
 * it. Catches the syntax/parse-fail class. Plus an App.jsx default-export check
 * (the runtime loads the default export). NOT the real vibes lint.
 */
export async function buildCheck(files: Record<string, string>): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const app = files["App.jsx"] ?? files["/App.jsx"];
  if (!app) return { ok: false, errors: ["App.jsx is missing"] };
  if (!/export\s+default\s+/.test(app)) errors.push("App.jsx has no default export");

  for (const [name, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(name)) continue;
    try {
      await transform(code, { loader: name.endsWith("x") ? "jsx" : "js", format: "esm", jsx: "automatic" });
    } catch (e) {
      const msg = (e as { errors?: { text: string; location?: { line: number } }[] }).errors
        ?.map((er) => `${name}:${er.location?.line ?? "?"} ${er.text}`)
        .join("; ") ?? `${name}: ${(e as Error).message}`;
      errors.push(msg);
    }
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/build-check.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/build-check.ts eval/codegen-agentic/src/build-check.test.ts
git commit -m "feat(codegen-agentic): esbuild build-check gate"
```

---

### Task 5: prompt (per-mode prompt builder)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/prompt.ts`, `eval/codegen-agentic/src/prompt.test.ts`

**Interfaces:**
- Consumes: `ModeName` (from Task 2)
- Produces: `buildPrompt(mode: ModeName, systemPrompt: string, userPrompt: string): { instructions: string; input: string }`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt.js";

describe("buildPrompt", () => {
  it("one-shot instructs filename-fenced whole-file output", () => {
    const r = buildPrompt("oneshot", "RULES", "make a counter");
    expect(r.instructions).toContain("RULES");
    expect(r.instructions).toMatch(/filename on its own line/i);
    expect(r.instructions).not.toMatch(/write_file/i);
    expect(r.input).toBe("make a counter");
  });
  it("agentic instructs use of the write_file tool", () => {
    const r = buildPrompt("agentic", "RULES", "make a counter");
    expect(r.instructions).toContain("RULES");
    expect(r.instructions).toMatch(/write_file/i);
    expect(r.instructions).not.toMatch(/fenced/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/prompt.ts`:

```ts
import type { ModeName } from "./cell.js";

const ONESHOT_IO =
  "\n\n## Output\nEmit each complete file as a fenced code block with the filename on its own line " +
  "immediately before it (e.g. a line `App.jsx` then a ```jsx block, then a line `access.js` then a ```js block). " +
  "Emit whole files, not diffs. Output only the files (a short intro line is fine).";

const AGENTIC_IO =
  "\n\n## Output\nWrite each file by calling the `write_file` tool with `{ path, contents }` (e.g. path `App.jsx`, " +
  "then `access.js` if needed). The tool returns a build + structural check; if it reports problems, call `write_file` " +
  "again with corrected contents. Stop once the check passes.";

export function buildPrompt(mode: ModeName, systemPrompt: string, userPrompt: string): { instructions: string; input: string } {
  return { instructions: systemPrompt + (mode === "oneshot" ? ONESHOT_IO : AGENTIC_IO), input: userPrompt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/prompt.ts eval/codegen-agentic/src/prompt.test.ts
git commit -m "feat(codegen-agentic): per-mode prompt builder"
```

---

### Task 6: cost (per-generation cost/token extraction)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/cost.ts`, `eval/codegen-agentic/src/cost.test.ts`

**Interfaces:**
- Produces: `extractCost(response: { totalCost?: number; usage?: { totalTokens?: number; cost?: number } }): { costUsd: number; tokens: number }`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/cost.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractCost } from "./cost.js";

describe("extractCost", () => {
  it("prefers top-level totalCost", () => {
    expect(extractCost({ totalCost: 0.012, usage: { totalTokens: 900, cost: 0.011 } })).toEqual({ costUsd: 0.012, tokens: 900 });
  });
  it("falls back to usage.cost", () => {
    expect(extractCost({ usage: { totalTokens: 500, cost: 0.004 } })).toEqual({ costUsd: 0.004, tokens: 500 });
  });
  it("defaults to zero when absent", () => {
    expect(extractCost({})).toEqual({ costUsd: 0, tokens: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/cost.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/cost.ts`:

```ts
/**
 * Normalize cost/tokens from an @openrouter/agent response. The accumulated
 * `totalCost` (across all turns of an agentic run) is authoritative when
 * present; otherwise fall back to the usage block.
 */
export interface CostSource {
  readonly totalCost?: number;
  readonly usage?: { readonly totalTokens?: number; readonly cost?: number };
}
export function extractCost(response: CostSource): { costUsd: number; tokens: number } {
  return {
    costUsd: response.totalCost ?? response.usage?.cost ?? 0,
    tokens: response.usage?.totalTokens ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/cost.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/cost.ts eval/codegen-agentic/src/cost.test.ts
git commit -m "feat(codegen-agentic): cost/token extraction"
```

---

### Task 7: config (matrix + prompts loader)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/config.ts`, `eval/codegen-agentic/src/config.test.ts`

**Interfaces:**
- Consumes: `MatrixConfig`, `PromptEntry` (from Task 2)
- Produces: `parseMatrix(text: string): MatrixConfig`, `parsePrompts(text: string): PromptEntry[]`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMatrix, parsePrompts } from "./config.js";

describe("parseMatrix", () => {
  it("parses a valid matrix", () => {
    const m = parseMatrix(JSON.stringify({
      judgeModel: "j", reps: 2, modes: ["oneshot", "agentic"], concurrency: 4,
      maxSteps: 4, maxCostUsd: 0.5, budgetUsdTotal: 50, featureAcceptBar: 3,
      models: [{ id: "a/b", openWeight: true }],
    }));
    expect(m.models[0].id).toBe("a/b");
    expect(m.modes).toEqual(["oneshot", "agentic"]);
  });
  it("rejects an empty model list", () => {
    expect(() => parseMatrix(JSON.stringify({ judgeModel: "j", reps: 1, modes: ["oneshot"], concurrency: 1, maxSteps: 1, maxCostUsd: 1, budgetUsdTotal: 1, featureAcceptBar: 3, models: [] }))).toThrow();
  });
});

describe("parsePrompts", () => {
  it("parses jsonl with needsAccess", () => {
    const p = parsePrompts(`{"id":"x","needsAccess":true,"prompt":"p"}\n\n{"id":"y","needsAccess":false,"prompt":"q"}`);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ id: "x", needsAccess: true, prompt: "p" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/config.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/config.ts`:

```ts
import type { MatrixConfig, PromptEntry } from "./cell.js";

export function parseMatrix(text: string): MatrixConfig {
  const m = JSON.parse(text) as MatrixConfig;
  if (!Array.isArray(m.models) || m.models.length === 0) throw new Error("matrix.models must be a non-empty array");
  for (const k of ["judgeModel", "reps", "modes", "concurrency", "maxSteps", "maxCostUsd", "budgetUsdTotal", "featureAcceptBar"] as const) {
    if (m[k] === undefined) throw new Error(`matrix.${k} is required`);
  }
  return m;
}

export function parsePrompts(text: string): PromptEntry[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const e = JSON.parse(l) as PromptEntry;
      if (!e.id || typeof e.prompt !== "string" || typeof e.needsAccess !== "boolean") {
        throw new Error(`bad prompt line: ${l.slice(0, 60)}`);
      }
      return e;
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/config.ts eval/codegen-agentic/src/config.test.ts
git commit -m "feat(codegen-agentic): matrix + prompts config loader"
```

---

### Task 8: pool (bounded concurrency helper)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/pool.ts`, `eval/codegen-agentic/src/pool.test.ts`

**Interfaces:**
- Produces: `mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/pool.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./pool.js";

describe("mapWithConcurrency", () => {
  it("runs all items and preserves order", async () => {
    const r = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(r).toEqual([10, 20, 30, 40]);
  });
  it("never exceeds the concurrency limit", async () => {
    let active = 0, peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/pool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/pool.ts`:

```ts
/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: n }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/pool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/pool.ts eval/codegen-agentic/src/pool.test.ts
git commit -m "feat(codegen-agentic): bounded-concurrency pool"
```

---

### Task 9: feedback (build + structural → loop message)

**Type:** implementation
**Depends-on:** 1, 2, 4

**Files:**
- Create: `eval/codegen-agentic/src/feedback.ts`, `eval/codegen-agentic/src/feedback.test.ts`

**Interfaces:**
- Consumes: `computeStructure`, `StructureSignals` (from Task 1, `@vibes.diy/eval-codegen-matrix/scoring`); the `{ ok, errors }` shape of `buildCheck` (from Task 4)
- Produces: `evaluateProgress(files, buildResult, needsAccess): { clean: boolean; message: string }`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/feedback.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evaluateProgress } from "./feedback.js";

const goodApp = {
  "App.jsx": `import { useVibe } from "use-vibes";\nexport default function App(){ const {can}=useVibe("x"); can.create({}); return null; }`,
  "access.js": `export function x(doc,old,user,ctx){ ctx.requireAccess("list:"+doc.id); return {channels:[]}; }`,
};

describe("evaluateProgress", () => {
  it("clean when build passes and access.js present for a needsAccess prompt", () => {
    const r = evaluateProgress(goodApp, { ok: true, errors: [] }, true);
    expect(r.clean).toBe(true);
  });
  it("not clean and names the build error", () => {
    const r = evaluateProgress(goodApp, { ok: false, errors: ["App.jsx:3 oops"] }, false);
    expect(r.clean).toBe(false);
    expect(r.message).toMatch(/App\.jsx:3 oops/);
  });
  it("not clean when a needsAccess prompt has no access.js", () => {
    const r = evaluateProgress({ "App.jsx": goodApp["App.jsx"] }, { ok: true, errors: [] }, true);
    expect(r.clean).toBe(false);
    expect(r.message).toMatch(/access\.js/);
  });
  it("ignores access.js requirement when needsAccess is false", () => {
    const r = evaluateProgress({ "App.jsx": goodApp["App.jsx"] }, { ok: true, errors: [] }, false);
    expect(r.clean).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/feedback.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/feedback.ts`:

```ts
import { computeStructure } from "@vibes.diy/eval-codegen-matrix/scoring";

/**
 * Turn the build result + structural signals into the agentic loop's feedback.
 * `clean` means: build passes AND (if the prompt needs permissions) a separate
 * access.js exists. The message is what the model sees as the write_file tool's
 * return value, so it must be specific and actionable.
 */
export function evaluateProgress(
  files: Record<string, string>,
  buildResult: { ok: boolean; errors: string[] },
  needsAccess: boolean
): { clean: boolean; message: string } {
  const problems: string[] = [];
  if (!buildResult.ok) problems.push(`Build failed: ${buildResult.errors.join("; ")}`);
  const s = computeStructure(files);
  if (needsAccess && !s.hasAccessJs) {
    problems.push("This app needs per-document permissions but no separate access.js was written. Add an access.js that exports the access function.");
  }
  if (needsAccess && s.accessInAppJsx) {
    problems.push("Access-control logic is in App.jsx; move it into access.js.");
  }
  if (problems.length === 0) return { clean: true, message: "Build and structural checks pass. The app is complete." };
  return { clean: false, message: problems.join("\n") };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/feedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/feedback.ts eval/codegen-agentic/src/feedback.test.ts
git commit -m "feat(codegen-agentic): loop feedback from build + structure"
```

---

### Task 10: client (OpenRouter SDK wrapper)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/client.ts`

**Interfaces:**
- Consumes: `@openrouter/agent` (`OpenRouter`)
- Produces: `makeClient(): OpenRouter` (reads `OPENROUTER_API_KEY`; throws a clear error if unset)

- [ ] **Step 1: Write the implementation**

`eval/codegen-agentic/src/client.ts`:

```ts
import { OpenRouter } from "@openrouter/agent";

/**
 * Construct the OpenRouter client. The key is read from OPENROUTER_API_KEY
 * (fed from the macOS Keychain at invocation time) and never logged.
 */
export function makeClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Provide it inline, e.g. " +
        'OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" pnpm run generate'
    );
  }
  return new OpenRouter({ apiKey });
}
```

- [ ] **Step 2: Type-check**

Run: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors (confirms the `@openrouter/agent` `OpenRouter` import resolves). If the named import differs in the installed version, consult the `openrouter-typescript-sdk` skill and adjust the import to match; keep `makeClient`'s signature.

- [ ] **Step 3: Commit**

```bash
git add eval/codegen-agentic/src/client.ts
git commit -m "feat(codegen-agentic): OpenRouter client wrapper"
```

---

### Task 11: oneshot generator

**Type:** implementation
**Depends-on:** 2, 3, 4, 5, 6, 10

**Files:**
- Create: `eval/codegen-agentic/src/oneshot.ts`

**Interfaces:**
- Consumes: `makeClient` (Task 10), `parseFiles` (Task 3), `buildCheck` (Task 4), `buildPrompt` (Task 5), `extractCost` (Task 6), `GenResult` (Task 2)
- Produces: `runOneShot(client, model, systemPrompt, userPrompt): Promise<GenResult>`

- [ ] **Step 1: Write the implementation**

`eval/codegen-agentic/src/oneshot.ts`:

```ts
import type { OpenRouter } from "@openrouter/agent";
import type { GenResult } from "./cell.js";
import { buildPrompt } from "./prompt.js";
import { parseFiles } from "./parse-files.js";
import { buildCheck } from "./build-check.js";
import { extractCost } from "./cost.js";

/** One completion, parse the emitted files, run a single build-check (no iteration). */
export async function runOneShot(
  client: OpenRouter,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GenResult> {
  const { instructions, input } = buildPrompt("oneshot", systemPrompt, userPrompt);
  try {
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
  } catch (e) {
    return { files: {}, steps: 1, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200) };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add eval/codegen-agentic/src/oneshot.ts
git commit -m "feat(codegen-agentic): one-shot generator"
```

---

### Task 12: agentic generator + loop-control test

**Type:** implementation
**Depends-on:** 1, 2, 4, 5, 6, 9, 10

**Files:**
- Create: `eval/codegen-agentic/src/agentic.ts`, `eval/codegen-agentic/src/agentic.test.ts`

**Interfaces:**
- Consumes: `makeClient`/`OpenRouter` (Task 10), `buildPrompt` (Task 5), `buildCheck` (Task 4), `evaluateProgress` (Task 9), `extractCost` (Task 6), `GenResult` (Task 2)
- Produces: `runAgentic(client, model, systemPrompt, userPrompt, opts): Promise<GenResult>`, and an exported pure helper `makeWriteFileExecutor(files, getNeedsAccess)` returning `(args) => Promise<{ ok, feedback }>` so the loop logic is unit-testable without the SDK.

**Parallelization rationale:** splitting the file-writing/feedback executor out as a pure exported helper (rather than an inline closure) lets the loop's accept/iterate behavior be unit-tested against a fake tool driver with no network — a real test-isolation win, and good design regardless of parallelism.

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/agentic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeWriteFileExecutor } from "./agentic.js";

describe("makeWriteFileExecutor", () => {
  it("accumulates files and reports clean when build+structure pass", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => false);
    const r = await exec({ path: "App.jsx", contents: `import React from "react";\nexport default function App(){ return <div/>; }` });
    expect(files["App.jsx"]).toContain("export default");
    expect(r.ok).toBe(true);
    expect(r.feedback).toMatch(/pass/i);
  });
  it("reports not-clean with the build error and lets a later write fix it", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => false);
    const bad = await exec({ path: "App.jsx", contents: `export default function App(){ return <div ;` });
    expect(bad.ok).toBe(false);
    const good = await exec({ path: "App.jsx", contents: `import React from "react";\nexport default function App(){ return <div/>; }` });
    expect(good.ok).toBe(true);
  });
  it("requires access.js when needsAccess is true", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => true);
    const r = await exec({ path: "App.jsx", contents: `import React from "react";\nexport default function App(){ return <div/>; }` });
    expect(r.ok).toBe(false);
    expect(r.feedback).toMatch(/access\.js/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/agentic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/agentic.ts`:

```ts
import { z } from "zod";
import { tool } from "@openrouter/agent/tool";
import { stepCountIs, maxCost } from "@openrouter/agent/stop-conditions";
import type { OpenRouter } from "@openrouter/agent";
import type { GenResult } from "./cell.js";
import { buildPrompt } from "./prompt.js";
import { buildCheck } from "./build-check.js";
import { evaluateProgress } from "./feedback.js";
import { extractCost } from "./cost.js";

/**
 * The write_file executor: writes into the shared `files` map, runs the
 * build + structural check, and returns the result the model reacts to. Pure
 * w.r.t. the SDK (no network), so the loop's accept/iterate logic is testable
 * with a fake driver.
 */
export function makeWriteFileExecutor(
  files: Record<string, string>,
  getNeedsAccess: () => boolean
): (args: { path: string; contents: string }) => Promise<{ ok: boolean; feedback: string }> {
  return async ({ path, contents }) => {
    files[path] = contents;
    const build = await buildCheck(files);
    const { clean, message } = evaluateProgress(files, build, getNeedsAccess());
    return { ok: clean, feedback: message };
  };
}

export async function runAgentic(
  client: OpenRouter,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxSteps: number; maxCostUsd: number; needsAccess: boolean }
): Promise<GenResult> {
  const files: Record<string, string> = {};
  let steps = 0;
  const exec = makeWriteFileExecutor(files, () => opts.needsAccess);
  const writeFile = tool({
    name: "write_file",
    description: "Write a complete file (App.jsx or access.js). Returns a build + structural check; fix problems by calling again.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    execute: async (args: { path: string; contents: string }) => {
      steps++;
      return exec(args);
    },
  });
  const { instructions, input } = buildPrompt("agentic", systemPrompt, userPrompt);
  try {
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
  } catch (e) {
    return { files, steps, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/agentic.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Type-check (confirms the SDK tool/stop-condition imports)**

Run: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors. If a stop-condition or `tool` import path differs in the installed `@openrouter/agent`, consult the `openrouter-agent-migration` skill and correct the specifier; keep the function signatures and the executor split.

- [ ] **Step 6: Commit**

```bash
git add eval/codegen-agentic/src/agentic.ts eval/codegen-agentic/src/agentic.test.ts
git commit -m "feat(codegen-agentic): agentic write_file loop + executor test"
```

---

### Task 13: generate (orchestrator, preflight, cost guardrails)

**Type:** implementation
**Depends-on:** 2, 4, 6, 7, 8, 10, 11, 12

**Files:**
- Create: `eval/codegen-agentic/src/generate.ts`

**Interfaces:**
- Consumes: `parseMatrix`/`parsePrompts` (Task 7), `makeClient` (Task 10), `runOneShot` (Task 11), `runAgentic` (Task 12), `mapWithConcurrency` (Task 8), `cellDirName`/`CellResult`/`RUN_JSON`/`CELL_JSON` (Task 2)
- Produces: writes `runs/<ts>/<cell>/cell.json` (a `CellResult` + the generated files on disk) and `runs/<ts>/run.json`

- [ ] **Step 1: Write the implementation**

`eval/codegen-agentic/src/generate.ts`:

```ts
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseMatrix, parsePrompts } from "./config.js";
import { makeClient } from "./client.js";
import { runOneShot } from "./oneshot.js";
import { runAgentic } from "./agentic.js";
import { mapWithConcurrency } from "./pool.js";
import { cellDirName, CELL_JSON, RUN_JSON, type CellResult, type MatrixConfig, type ModeName, type PromptEntry } from "./cell.js";
import type { OpenRouter } from "@openrouter/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface Job { model: string; openWeight: boolean; prompt: PromptEntry; rep: number; mode: ModeName; }

async function runJob(client: OpenRouter, cfg: MatrixConfig, systemPrompt: string, job: Job, runDir: string): Promise<CellResult> {
  const gen = job.mode === "oneshot"
    ? await runOneShot(client, job.model, systemPrompt, job.prompt.prompt)
    : await runAgentic(client, job.model, systemPrompt, job.prompt.prompt, { maxSteps: cfg.maxSteps, maxCostUsd: cfg.maxCostUsd, needsAccess: job.prompt.needsAccess });
  const cell: CellResult = { ...gen, promptId: job.prompt.id, model: job.model, mode: job.mode, rep: job.rep, openWeight: job.openWeight, needsAccess: job.prompt.needsAccess };
  const cellDir = join(runDir, cellDirName(job.prompt.id, job.model, job.rep, job.mode));
  mkdirSync(cellDir, { recursive: true });
  for (const [path, contents] of Object.entries(gen.files)) writeFileSync(join(cellDir, path), contents, "utf-8");
  const { files: _omit, ...meta } = cell; // keep cell.json lean; files are on disk
  writeFileSync(join(cellDir, CELL_JSON), JSON.stringify({ ...meta, fileNames: Object.keys(gen.files) }, null, 2), "utf-8");
  stderr.write(`  ${job.prompt.id} ${job.model} r${job.rep} ${job.mode}: ${gen.exitState} build=${gen.buildPass} steps=${gen.steps} $${gen.costUsd.toFixed(4)}\n`);
  return cell;
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  return argv[ix].includes("=") ? argv[ix].slice(argv[ix].indexOf("=") + 1) : argv[ix + 1];
}

export async function main(): Promise<void> {
  const cfg = parseMatrix(readFileSync(parseFlag("--matrix") ?? join(ROOT, "config/matrix.json"), "utf-8"));
  const prompts = parsePrompts(readFileSync(parseFlag("--prompts") ?? join(ROOT, "config/prompts.jsonl"), "utf-8"));
  const systemPrompt = readFileSync(parseFlag("--system") ?? join(ROOT, "config/system-prompt.md"), "utf-8");
  const client = makeClient();
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = join(ROOT, "runs", ts);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, RUN_JSON), JSON.stringify({ startedAt: new Date().toISOString(), judgeModel: cfg.judgeModel, reps: cfg.reps, modes: cfg.modes, maxSteps: cfg.maxSteps, maxCostUsd: cfg.maxCostUsd, models: cfg.models.map((m) => m.id) }, null, 2), "utf-8");

  // Preflight: one smoke cell (first model, first prompt, both modes) before the sweep.
  const smokeModel = cfg.models[0];
  for (const mode of cfg.modes) {
    const r = await runJob(client, cfg, systemPrompt, { model: smokeModel.id, openWeight: smokeModel.openWeight, prompt: prompts[0], rep: 0, mode }, runDir);
    if (r.exitState === "errored") throw new Error(`preflight ${mode} errored: ${r.note}`);
  }
  stderr.write(`preflight ok. proceeding to full sweep.\n`);

  const jobs: Job[] = [];
  for (const model of cfg.models) for (const prompt of prompts) for (const mode of cfg.modes) for (let rep = 0; rep < cfg.reps; rep++) {
    if (model.id === smokeModel.id && prompt.id === prompts[0].id && rep === 0) continue; // already ran in preflight
    jobs.push({ model: model.id, openWeight: model.openWeight, prompt, rep, mode });
  }

  let spent = 0;
  stderr.write(`codegen-agentic: ${jobs.length} cells, concurrency=${cfg.concurrency}, budget $${cfg.budgetUsdTotal} -> ${runDir}\n`);
  await mapWithConcurrency(jobs, cfg.concurrency, async (job) => {
    if (spent >= cfg.budgetUsdTotal) return; // hard budget halt
    const r = await runJob(client, cfg, systemPrompt, job, runDir);
    spent += r.costUsd;
    stderr.write(`  [budget] spent $${spent.toFixed(2)} / $${cfg.budgetUsdTotal}\n`);
  });
  stderr.write(`done. spent ~$${spent.toFixed(2)}. run dir: ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { stderr.write(`generate failed: ${(e as Error).stack ?? (e as Error).message}\n`); process.exit(1); });
}
```

- [ ] **Step 2: Type-check**

Run: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add eval/codegen-agentic/src/generate.ts
git commit -m "feat(codegen-agentic): generate orchestrator with preflight + budget cap"
```

---

### Task 14: score (reuse rubric + structure + feature judge)

**Type:** implementation
**Depends-on:** 1, 2

**Files:**
- Create: `eval/codegen-agentic/src/score.ts`

**Interfaces:**
- Consumes: `runRubric`, `computeStructure`, `judgeFeature`, `readDevVars`, `collectSourceFiles` (Task 1); `CellScore`/`CELL_JSON`/`CELL_SCORE_JSON` (Task 2)
- Produces: writes `runs/<ts>/<cell>/cell.score.json` (a `CellScore`) for each generated cell

- [ ] **Step 1: Write the implementation**

`eval/codegen-agentic/src/score.ts`:

```ts
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { runRubric, computeStructure, judgeFeature, readDevVars, collectSourceFiles, type JudgeDeps } from "@vibes.diy/eval-codegen-matrix/scoring";
import { CELL_JSON, CELL_SCORE_JSON, type CellScore } from "./cell.js";
import { parsePrompts } from "./config.js";
import { mapWithConcurrency } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  return argv[ix].includes("=") ? argv[ix].slice(argv[ix].indexOf("=") + 1) : argv[ix + 1];
}
function latestRunDir(): string {
  const runs = resolve(ROOT, "runs");
  const dirs = readdirSync(runs).filter((n) => n !== ".gitignore").sort();
  if (!dirs.length) throw new Error(`no runs under ${runs}`);
  return join(runs, dirs[dirs.length - 1]);
}

async function main(): Promise<void> {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const prompts = parsePrompts(readFileSync(parseFlag("--prompts") ?? join(ROOT, "config/prompts.jsonl"), "utf-8"));
  const promptText = new Map(prompts.map((p) => [p.id, p.prompt]));
  const deps: JudgeDeps = { devVars: readDevVars(), judgeModel: JSON.parse(readFileSync(join(ROOT, "config/matrix.json"), "utf-8")).judgeModel };
  const cellDirs = readdirSync(runDir).filter((n) => existsSync(join(runDir, n, CELL_JSON)));
  stderr.write(`scoring ${cellDirs.length} cells in ${runDir}\n`);
  let scored = 0, nullJudge = 0;
  await mapWithConcurrency(cellDirs, 4, async (name) => {
    const cellDir = join(runDir, name);
    const cell = JSON.parse(readFileSync(join(cellDir, CELL_JSON), "utf-8")) as { promptId: string; model: string; mode: CellScore["mode"]; rep: number; exitState: string };
    if (cell.exitState !== "ok") { stderr.write(`  skip ${name}: ${cell.exitState}\n`); return; }
    const files = collectSourceFiles(cellDir);
    const rubric = runRubric(files);
    const structure = computeStructure(files);
    const feature = await judgeFeature(promptText.get(cell.promptId) ?? "", files, deps);
    const score: CellScore = { promptId: cell.promptId, model: cell.model, mode: cell.mode, rep: cell.rep, rubric, feature, structure };
    writeFileSync(join(cellDir, CELL_SCORE_JSON), JSON.stringify(score, null, 2), "utf-8");
    scored++;
    if (feature.score === null) nullJudge++;
    stderr.write(`  scored ${name}: rubric=${rubric.passed}/${rubric.total} feature=${feature.score}\n`);
  });
  if (scored > 0 && nullJudge / scored > 0.2) stderr.write(`WARNING: ${nullJudge}/${scored} cells have a null judge score (${Math.round((100 * nullJudge) / scored)}%).\n`);
  stderr.write(`done scoring ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { stderr.write(`score failed: ${(e as Error).stack ?? (e as Error).message}\n`); process.exit(1); });
}
```

- [ ] **Step 2: Type-check**

Run: `cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors (confirms the scoring-barrel import resolves and the `JudgeDeps` shape matches).

- [ ] **Step 3: Commit**

```bash
git add eval/codegen-agentic/src/score.ts
git commit -m "feat(codegen-agentic): score stage reusing codegen-matrix scoring"
```

---

### Task 15: report (per-model × mode aggregation, deltas, $/acceptable)

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/src/report.ts`, `eval/codegen-agentic/src/report.test.ts`

**Interfaces:**
- Consumes: `CellScore`/`CellResult` shapes (Task 2)
- Produces: `aggregate(rows): ModelModeStat[]`, `isAcceptable(row, bar): boolean`, `renderReport(stats): string`; the `main()` writes `summary.md` + `index.jsonl`

- [ ] **Step 1: Write the failing test**

`eval/codegen-agentic/src/report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAcceptable, aggregate, type ReportRow } from "./report.js";

const base: ReportRow = { model: "m", mode: "oneshot", openWeight: true, promptId: "p", needsAccess: false, buildPass: true, feature: 4, costUsd: 0.01, hasAccessJs: false };

describe("isAcceptable", () => {
  it("true when build passes and feature meets the bar (no access needed)", () => {
    expect(isAcceptable(base, 3)).toBe(true);
  });
  it("false when feature below bar", () => {
    expect(isAcceptable({ ...base, feature: 2 }, 3)).toBe(false);
  });
  it("false when needsAccess but no access.js", () => {
    expect(isAcceptable({ ...base, needsAccess: true, hasAccessJs: false }, 3)).toBe(false);
  });
  it("true when needsAccess and access.js present", () => {
    expect(isAcceptable({ ...base, needsAccess: true, hasAccessJs: true }, 3)).toBe(true);
  });
});

describe("aggregate", () => {
  it("computes per-model×mode build-pass rate, mean feature, and $/acceptable", () => {
    const rows: ReportRow[] = [
      { ...base, buildPass: true, feature: 4, costUsd: 0.02 },
      { ...base, buildPass: false, feature: 1, costUsd: 0.01 },
    ];
    const [s] = aggregate(rows, 3);
    expect(s.model).toBe("m");
    expect(s.buildPassRate).toBeCloseTo(0.5);
    expect(s.meanFeature).toBeCloseTo(2.5);
    expect(s.acceptable).toBe(1);
    expect(s.costPerAcceptable).toBeCloseTo(0.03); // total $0.03 / 1 acceptable
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/report.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`eval/codegen-agentic/src/report.ts`:

```ts
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { CELL_JSON, CELL_SCORE_JSON, type ModeName } from "./cell.js";

export interface ReportRow {
  model: string; mode: ModeName; openWeight: boolean; promptId: string; needsAccess: boolean;
  buildPass: boolean; feature: number | null; costUsd: number; hasAccessJs: boolean;
}
export interface ModelModeStat {
  model: string; mode: ModeName; openWeight: boolean; n: number;
  buildPassRate: number; meanFeature: number | null; acceptable: number; costPerAcceptable: number | null; meanCostUsd: number;
}

export function isAcceptable(r: ReportRow, bar: number): boolean {
  return r.buildPass && r.feature !== null && r.feature >= bar && (!r.needsAccess || r.hasAccessJs);
}

export function aggregate(rows: readonly ReportRow[], bar: number): ModelModeStat[] {
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = `${r.model} ${r.mode}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: ModelModeStat[] = [];
  for (const g of groups.values()) {
    const feats = g.map((r) => r.feature).filter((f): f is number => f !== null);
    const acceptable = g.filter((r) => isAcceptable(r, bar)).length;
    const totalCost = g.reduce((a, r) => a + r.costUsd, 0);
    out.push({
      model: g[0].model, mode: g[0].mode, openWeight: g[0].openWeight, n: g.length,
      buildPassRate: g.filter((r) => r.buildPass).length / g.length,
      meanFeature: feats.length ? feats.reduce((a, b) => a + b, 0) / feats.length : null,
      acceptable, costPerAcceptable: acceptable ? totalCost / acceptable : null, meanCostUsd: totalCost / g.length,
    });
  }
  return out.sort((a, b) => a.model.localeCompare(b.model) || a.mode.localeCompare(b.mode));
}

function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function num(n: number | null, d = 2): string { return n === null ? "—" : n.toFixed(d); }

export function renderReport(stats: readonly ModelModeStat[]): string {
  const header = "| model | open? | mode | n | build-pass | mean feature | acceptable | $/acceptable | mean $/gen |";
  const sep = "| --- | --- | --- | --: | --: | --: | --: | --: | --: |";
  const body = stats.map((s) => `| ${s.model} | ${s.openWeight ? "open" : "closed"} | ${s.mode} | ${s.n} | ${pct(s.buildPassRate)} | ${num(s.meanFeature)} | ${s.acceptable}/${s.n} | ${s.costPerAcceptable === null ? "—" : "$" + s.costPerAcceptable.toFixed(4)} | $${s.meanCostUsd.toFixed(4)} |`);
  // Delta table: one-shot -> agentic per model.
  const byModel = new Map<string, Record<ModeName, ModelModeStat>>();
  for (const s of stats) { const e = byModel.get(s.model) ?? ({} as Record<ModeName, ModelModeStat>); e[s.mode] = s; byModel.set(s.model, e); }
  const delta = [...byModel.entries()].filter(([, e]) => e.oneshot && e.agentic).map(([m, e]) => {
    const df = (e.agentic.meanFeature ?? 0) - (e.oneshot.meanFeature ?? 0);
    const db = e.agentic.buildPassRate - e.oneshot.buildPassRate;
    return `| ${m} | ${pct(e.oneshot.buildPassRate)} → ${pct(e.agentic.buildPassRate)} (${db >= 0 ? "+" : ""}${pct(db)}) | ${num(e.oneshot.meanFeature)} → ${num(e.agentic.meanFeature)} (${df >= 0 ? "+" : ""}${df.toFixed(2)}) |`;
  });
  return [
    "# codegen-agentic summary", "",
    "## Per-model × mode", "", header, sep, ...body, "",
    "## one-shot → agentic delta (the confound-removal result)", "",
    "| model | build-pass | mean feature |", "| --- | --- | --- |", ...delta, "",
  ].join("\n");
}

function main(): void {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const runs = resolve(ROOT, "runs");
  const dirs = readdirSync(runs).filter((n) => n !== ".gitignore").sort();
  if (!dirs.length) throw new Error("no runs");
  const runDir = join(runs, dirs[dirs.length - 1]);
  const bar = JSON.parse(readFileSync(join(ROOT, "config/matrix.json"), "utf-8")).featureAcceptBar as number;
  const rows: ReportRow[] = [];
  for (const name of readdirSync(runDir)) {
    const cellDir = join(runDir, name);
    if (!existsSync(join(cellDir, CELL_JSON))) continue;
    const cell = JSON.parse(readFileSync(join(cellDir, CELL_JSON), "utf-8")) as { model: string; mode: ModeName; openWeight: boolean; promptId: string; needsAccess: boolean; buildPass: boolean; costUsd: number };
    const sp = join(cellDir, CELL_SCORE_JSON);
    const score = existsSync(sp) ? JSON.parse(readFileSync(sp, "utf-8")) : undefined;
    rows.push({ model: cell.model, mode: cell.mode, openWeight: cell.openWeight, promptId: cell.promptId, needsAccess: cell.needsAccess, buildPass: cell.buildPass, costUsd: cell.costUsd, feature: score?.feature?.score ?? null, hasAccessJs: score?.structure?.hasAccessJs ?? false });
  }
  writeFileSync(join(runDir, "index.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
  writeFileSync(join(runDir, "summary.md"), renderReport(aggregate(rows, bar)), "utf-8");
  stderr.write(`wrote summary.md + index.jsonl to ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval/codegen-agentic && pnpm exec vitest --run src/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-agentic/src/report.ts eval/codegen-agentic/src/report.test.ts
git commit -m "feat(codegen-agentic): report — per-mode stats, delta, \$/acceptable"
```

---

### Task 16: README + runbook

**Type:** implementation
**Depends-on:** 2

**Files:**
- Create: `eval/codegen-agentic/README.md`, `agents/codegen-agentic-eval.md`
- Modify: `CLAUDE.md` (add the runbook link next to `codegen-matrix-eval.md`)

**Interfaces:**
- Produces: docs only.

- [ ] **Step 1: Write `eval/codegen-agentic/README.md`**

Document: purpose (one-shot vs agentic, confound removal), the three stages (`pnpm run generate` / `score` / `report`), config knobs (`matrix.json`: models, modes, maxSteps, maxCostUsd, budgetUsdTotal, featureAcceptBar), the **`OPENROUTER_API_KEY` requirement** with the keychain one-liner (`OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" pnpm run generate`), and that the judge reuses `LLM_BACKEND_*` (map the same key). State that build-check is a structural esbuild gate, not the real vibes lint, and that v1 is source-only (no design judge).

- [ ] **Step 2: Write `agents/codegen-agentic-eval.md`**

A runbook mirroring `agents/codegen-matrix-eval.md`: prerequisites (key, pnpm install), the run sequence, the cost guardrails (preflight, per-cell maxCost, aggregate budget), how to read the delta + $/acceptable tables, and the open-vs-closed tenability question this answers. Link the spec.

- [ ] **Step 3: Link it from CLAUDE.md**

In `CLAUDE.md`, under the agent-rules list (next to the `codegen-matrix-eval.md` bullet), add:

```markdown
- [codegen-agentic-eval.md](agents/codegen-agentic-eval.md) — Two-mode (one-shot vs agentic) tenability eval: isolates the tool-loop to measure open-weight viability + real $/acceptable.
```

- [ ] **Step 4: Commit**

```bash
git add eval/codegen-agentic/README.md agents/codegen-agentic-eval.md CLAUDE.md
git commit -m "docs(codegen-agentic): package README + runbook"
```

---

### Task G: Full verification gate

**Type:** gate
**Depends-on:** 1, 3, 4, 5, 6, 7, 8, 9, 12, 15, 16

**Files:** none (verification only)

Suite command (run from repo root):

```bash
pnpm exec vitest --run --project eval-codegen-agentic && cd eval/codegen-agentic && pnpm exec tsc --noEmit -p tsconfig.json
```

Expectations: all `eval-codegen-agentic` unit tests pass (parse-files, build-check, prompt, cost, config, pool, feedback, agentic-executor, report); `tsc --noEmit` is clean; `eval-codegen-matrix` tests remain green (Task 1 changed only the exports surface).

---

### Task R: Run the eval (operator action)

**Type:** manual
**Depends-on:** Task G

This is not a worktree-pure diff — it spends real OpenRouter credit and needs the key. Carry into the post-merge runbook:

```bash
cd eval/codegen-agentic
KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)"
OPENROUTER_API_KEY="$KEY" pnpm run generate
LLM_BACKEND_API_KEY="$KEY" LLM_BACKEND_URL="https://openrouter.ai/api/v1" pnpm run score
pnpm run report
cat runs/$(ls -1 runs | grep '^2' | tail -1)/summary.md
```

The preflight smoke runs first; if it errors, the sweep aborts. Watch the live `[budget]` meter; the run halts at `budgetUsdTotal`. Deliverable: the delta + $/acceptable tables answer the open-weight tenability question.

---

## Self-Review

**Spec coverage:** §2.1 modes → Tasks 5/11/12; §2.2 isolation → Task 5 (prompt held constant, I/O differs) + Global Constraints; §2.3 scope → Task 2 config; §2.4 metrics → Tasks 4 (buildPass), 12 (steps), 6 (cost), 14 (feature/rubric/structure); §2.5 acceptable → Task 15 `isAcceptable` (needsAccess flag); §2.6 outputs → Task 15 (per-mode table + delta + $/acceptable); §3 architecture → Tasks 1/2; §4 generation → 11/12 + 4; §5 scoring/cost → 14/6; §6 report → 15; §7 guardrails → 13 (preflight + budget), error handling → 11/12 exitState, testing → per-task tests + Task G. All sections covered.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; the two SDK tasks (10/12) note "if the installed API differs, consult the skill and adjust the specifier, keep the signature" — that is a real fallback instruction, not a placeholder, because the code shown is the documented API.

**Type consistency:** `GenResult`/`CellResult`/`CellScore`/`MatrixConfig`/`PromptEntry` defined in Task 2 and consumed unchanged in 11/12/13/14/15; `buildCheck` returns `{ok, errors}` in Task 4 and is consumed with that shape in 9/11/12; `evaluateProgress(files, buildResult, needsAccess)` defined in Task 9 and called identically in Task 12; `extractCost` shape matches the SDK response cast in 11/12.

**Decomposition shaping:** contract-first Tasks 1 (scoring barrel) and 2 (types) front-load the shared interfaces, enabling Wave 2's six independent pure modules (3–8) to build in parallel — rationale on Tasks 1 and 12. No file is `Modify`-shared within a wave (each task creates its own files; Task 2 is the only multi-file-modify and runs alone in Wave 1 alongside Task 1, which touches a disjoint package).

**Markers:** every task has `**Type:**` + `**Depends-on:**`; gate (G) and manual (R) are typed; `**Interfaces:**` populated where cross-task symbols flow; every consumed sibling symbol has a matching `**Depends-on:**`.
