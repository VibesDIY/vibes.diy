# `eval/codegen-matrix` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable harness that runs a fixed set of prompts across a configurable set of models (via the published `vibes-diy generate` CLI) and scores each `(model × prompt)` cell on speed, adherence, and design quality.

**Architecture:** Four independently-runnable stages that pass artifacts on disk — config → generate (CLI subprocess per cell) → score (deterministic rubric + `call-ai` feature/vision judges) → report (matrix table). Adding a model is a one-line config edit. Pure logic (config/cell/rubric/report/readiness) is unit-tested; network paths (generate/judge) get a manual smoke run.

**Tech Stack:** TypeScript (ESM), `tsx` runner, `call-ai` (workspace) for judge calls, `vitest` for tests, Node `child_process`/`fs`. Mirrors `eval/preamble-probe` and `eval/codegen-edit`.

**Spec:** `docs/superpowers/specs/2026-06-23-codegen-matrix-eval-design.md`

---

## File Structure

Created under `eval/codegen-matrix/`:

| File                   | Responsibility                                                          |
| ---------------------- | ----------------------------------------------------------------------- |
| `package.json`         | Workspace package (`@vibes.diy/eval-codegen-matrix`), scripts, deps     |
| `tsconfig.json`        | Extends root tsconfig                                                   |
| `vitest.config.ts`     | Named vitest project; registered in root `vitest.config.ts`             |
| `README.md`            | Quick-start + stage docs                                                |
| `config/matrix.json`   | Models, judge, apiUrl, reps                                             |
| `config/prompts.jsonl` | The three prompts                                                       |
| `runs/.gitignore`      | Ignore generated run outputs                                            |
| `src/config.ts`        | Load + validate `matrix.json` / `prompts.jsonl`                         |
| `src/cell.ts`          | Cell types, slug/path derivation, screenshot URL, artifact read/write   |
| `src/rubric.ts`        | Deterministic system-prompt rules (with `promptAnchor`)                 |
| `src/judge.ts`         | `.dev.vars` reader, `call-ai` feature + design judges                   |
| `src/readiness.ts`     | Screenshot 404→200 readiness poller (injectable fetch/sleep)            |
| `src/generate.ts`      | Stage 2 driver: CLI subprocess per cell, write `cell.json` + `run.json` |
| `src/score.ts`         | Stage 3 orchestrator: rubric + judges → `cell.score.json`               |
| `src/report.ts`        | Stage 4: join cells → `index.jsonl` + `summary.md`                      |

Modified:

- `pnpm-workspace.yaml` — add `eval/codegen-matrix`
- `vitest.config.ts` (root) — add `eval/codegen-matrix/vitest.config.ts` to `projects`

---

## Task 1: Scaffold the workspace package

**Files:**

- Create: `eval/codegen-matrix/package.json`
- Create: `eval/codegen-matrix/tsconfig.json`
- Create: `eval/codegen-matrix/vitest.config.ts`
- Create: `eval/codegen-matrix/runs/.gitignore`
- Create: `eval/codegen-matrix/src/smoke.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `vitest.config.ts` (root)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@vibes.diy/eval-codegen-matrix",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Cross-model codegen eval: run fixed prompts across models via the published CLI and score speed, adherence, and design.",
  "scripts": {
    "generate": "tsx src/generate.ts",
    "score": "tsx src/score.ts",
    "report": "tsx src/report.ts",
    "test": "vitest --run"
  },
  "dependencies": {
    "call-ai": "workspace:*",
    "tsx": "^4.22.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval-codegen-matrix",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/runs/**"],
  },
});
```

- [ ] **Step 4: Create `runs/.gitignore`**

```gitignore
# Generated run outputs — prompt + model output may be large/sensitive.
*
!.gitignore
```

- [ ] **Step 5: Add the package to `pnpm-workspace.yaml`**

Find the line `  - "eval/preamble-probe"` and add below it:

```yaml
- "eval/codegen-matrix"
```

- [ ] **Step 6: Register the vitest project in root `vitest.config.ts`**

In the root `vitest.config.ts`, find the `projects` array and add this entry after `"vibes-diy/vitest.config.ts",`:

```ts
      "eval/codegen-matrix/vitest.config.ts",
```

- [ ] **Step 7: Write a smoke test** in `eval/codegen-matrix/src/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("codegen-matrix scaffold", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install + run the smoke test**

Run: `pnpm install && pnpm exec vitest --run --project eval-codegen-matrix`
Expected: 1 passed.

- [ ] **Step 9: Commit**

```bash
git add eval/codegen-matrix pnpm-workspace.yaml vitest.config.ts
git commit -m "feat(eval): scaffold codegen-matrix package"
```

---

## Task 2: Config loader

**Files:**

- Create: `eval/codegen-matrix/src/config.ts`
- Test: `eval/codegen-matrix/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseMatrixConfig, parsePromptsJsonl } from "./config.js";

const goodMatrix = {
  cliCommand: "npx vibes-diy@latest",
  apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
  handle: "eval",
  judgeModel: "anthropic/claude-opus-4.5",
  reps: 3,
  screenshotTimeoutMs: 120000,
  models: [{ id: "anthropic/claude-sonnet-4.6", class: "anthropic", tier: "cheap" }],
};

describe("parseMatrixConfig", () => {
  it("accepts a valid config", () => {
    const cfg = parseMatrixConfig(JSON.stringify(goodMatrix));
    expect(cfg.reps).toBe(3);
    expect(cfg.models[0].tier).toBe("cheap");
  });

  it("rejects an empty models array", () => {
    expect(() => parseMatrixConfig(JSON.stringify({ ...goodMatrix, models: [] }))).toThrow(/at least one model/i);
  });

  it("rejects a bad tier", () => {
    const bad = { ...goodMatrix, models: [{ id: "x", class: "y", tier: "medium" }] };
    expect(() => parseMatrixConfig(JSON.stringify(bad))).toThrow(/tier/i);
  });

  it("rejects reps <= 0", () => {
    expect(() => parseMatrixConfig(JSON.stringify({ ...goodMatrix, reps: 0 }))).toThrow(/reps/i);
  });
});

describe("parsePromptsJsonl", () => {
  it("parses one entry per non-empty line", () => {
    const jsonl = `{"id":"a","prompt":"build a"}\n\n{"id":"b","prompt":"build b"}\n`;
    const entries = parsePromptsJsonl(jsonl);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("rejects an entry with an empty prompt", () => {
    expect(() => parsePromptsJsonl(`{"id":"a","prompt":""}`)).toThrow(/prompt/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/config.test.ts`
Expected: FAIL — cannot find module `./config.js`.

- [ ] **Step 3: Write `src/config.ts`**

```ts
export type Tier = "cheap" | "expensive";

export interface ModelEntry {
  readonly id: string;
  readonly class: string;
  readonly tier: Tier;
}

export interface MatrixConfig {
  readonly cliCommand: string;
  readonly apiUrl: string;
  readonly handle: string;
  readonly judgeModel: string;
  readonly reps: number;
  readonly screenshotTimeoutMs: number;
  readonly models: readonly ModelEntry[];
}

export interface PromptEntry {
  readonly id: string;
  readonly prompt: string;
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`config: "${key}" must be a non-empty string`);
  }
  return v;
}

function reqPositiveNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`config: "${key}" must be a number > 0`);
  }
  return v;
}

export function parseMatrixConfig(text: string): MatrixConfig {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const cliCommand = reqString(obj, "cliCommand");
  const apiUrl = reqString(obj, "apiUrl");
  const handle = reqString(obj, "handle");
  const judgeModel = reqString(obj, "judgeModel");
  const reps = reqPositiveNumber(obj, "reps");
  const screenshotTimeoutMs = reqPositiveNumber(obj, "screenshotTimeoutMs");
  const rawModels = obj.models;
  if (!Array.isArray(rawModels) || rawModels.length === 0) {
    throw new Error("config: must list at least one model");
  }
  const models = rawModels.map((m, i): ModelEntry => {
    const e = m as Record<string, unknown>;
    const tier = e.tier;
    if (tier !== "cheap" && tier !== "expensive") {
      throw new Error(`config: models[${i}].tier must be "cheap" or "expensive"`);
    }
    return { id: reqString(e, "id"), class: reqString(e, "class"), tier };
  });
  return { cliCommand, apiUrl, handle, judgeModel, reps, screenshotTimeoutMs, models };
}

export function parsePromptsJsonl(text: string): PromptEntry[] {
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line, i) => {
      const e = JSON.parse(line) as Record<string, unknown>;
      const id = e.id;
      const prompt = e.prompt;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(`prompts[${i}]: "id" must be a non-empty string`);
      }
      if (typeof prompt !== "string" || prompt.length === 0) {
        throw new Error(`prompts[${i}]: "prompt" must be a non-empty string`);
      }
      return { id, prompt };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/config.test.ts`
Expected: PASS — all assertions.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/config.ts eval/codegen-matrix/src/config.test.ts
git commit -m "feat(eval): codegen-matrix config loader + validation"
```

---

## Task 3: Cell helpers (types, slugs, paths, screenshot URL, IO)

**Files:**

- Create: `eval/codegen-matrix/src/cell.ts`
- Test: `eval/codegen-matrix/src/cell.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelSlug, cellDirName, screenshotUrl, discoverAppSlug, writeCellJson, readCellJson, type CellJson } from "./cell.js";

describe("modelSlug", () => {
  it("flattens provider/model ids to a filesystem-safe slug", () => {
    expect(modelSlug("anthropic/claude-opus-4.6-fast")).toBe("anthropic-claude-opus-4-6-fast");
  });
});

describe("cellDirName", () => {
  it("joins promptId, model slug, and rep", () => {
    expect(cellDirName("collab-lists", "google/gemini-2.5-flash-lite", 2)).toBe("collab-lists__google-gemini-2-5-flash-lite__r2");
  });
});

describe("screenshotUrl", () => {
  it("derives the runtime screenshot host from the api host", () => {
    expect(screenshotUrl("https://vibes.diy/api?.stable-entry.=cli", "my-app", "eval")).toBe(
      "https://my-app--eval.vibes.diy/screenshot.jpg"
    );
  });
});

describe("discoverAppSlug", () => {
  it("returns the sole subdirectory name", () => {
    expect(discoverAppSlug(["happy-otter-1234"])).toBe("happy-otter-1234");
  });
  it("returns undefined when there is no single subdir", () => {
    expect(discoverAppSlug([])).toBeUndefined();
    expect(discoverAppSlug(["a", "b"])).toBeUndefined();
  });
});

describe("cell.json round-trip", () => {
  it("writes and reads back a cell", () => {
    const dir = mkdtempSync(join(tmpdir(), "cm-cell-"));
    const cell: CellJson = {
      promptId: "collab-lists",
      model: "anthropic/claude-sonnet-4.6",
      class: "anthropic",
      tier: "cheap",
      rep: 0,
      appSlug: "happy-otter-1234",
      ownerHandle: "eval",
      directory: "/some/dir",
      latencyMs: 4200,
      exitState: "ok",
      stderrTail: "",
      apiUrl: "https://vibes.diy/api",
      cliVersion: "1.2.3",
      promptHash: "abc123",
    };
    writeCellJson(dir, cell);
    expect(readCellJson(dir)?.appSlug).toBe("happy-otter-1234");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/cell.test.ts`
Expected: FAIL — cannot find module `./cell.js`.

- [ ] **Step 3: Write `src/cell.ts`**

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CellJson {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly rep: number;
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly directory: string;
  readonly latencyMs: number;
  readonly exitState: "ok" | "generate-failed";
  readonly stderrTail: string;
  readonly apiUrl: string;
  readonly cliVersion: string;
  readonly promptHash: string;
}

export interface RubricResult {
  readonly passed: number;
  readonly total: number;
  readonly failedRules: readonly string[];
}

export interface JudgeResult {
  readonly score: number | null; // 1-5, or null on transport failure
  readonly reason: string;
  readonly judgeModel: string;
}

export interface DesignResult {
  readonly available: boolean;
  readonly score: number | null; // 1-5, or null
  readonly reason: string;
  readonly judgeModel: string;
}

export interface CellScore {
  readonly promptId: string;
  readonly model: string;
  readonly rep: number;
  readonly rubric: RubricResult;
  readonly feature: JudgeResult;
  readonly design: DesignResult;
}

export interface RunJson {
  readonly startedAt: string;
  readonly apiUrl: string;
  readonly cliCommand: string;
  readonly cliVersion: string;
  readonly commitSha: string;
  readonly judgeModel: string;
  readonly reps: number;
  readonly promptsHash: string;
}

export const CELL_JSON = "cell.json";
export const CELL_SCORE_JSON = "cell.score.json";
export const RUN_JSON = "run.json";

export function modelSlug(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cellDirName(promptId: string, model: string, rep: number): string {
  return `${promptId}__${modelSlug(model)}__r${rep}`;
}

/**
 * Runtime screenshot URL. The deployed vibe is served at
 * `<appSlug>--<ownerHandle>.<host>`; `<host>` is the api host (prod: vibes.diy).
 */
export function screenshotUrl(apiUrl: string, appSlug: string, ownerHandle: string): string {
  const host = new URL(apiUrl).hostname.replace(/^api\./, "");
  return `https://${appSlug}--${ownerHandle}.${host}/screenshot.jpg`;
}

/** The sole subdirectory the CLI creates in the (empty) per-cell cwd is the appSlug. */
export function discoverAppSlug(subdirNames: readonly string[]): string | undefined {
  return subdirNames.length === 1 ? subdirNames[0] : undefined;
}

export function writeCellJson(dir: string, cell: CellJson): void {
  writeFileSync(join(dir, CELL_JSON), JSON.stringify(cell, null, 2), "utf-8");
}

export function readCellJson(dir: string): CellJson | undefined {
  const p = join(dir, CELL_JSON);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as CellJson) : undefined;
}

export function writeCellScore(dir: string, score: CellScore): void {
  writeFileSync(join(dir, CELL_SCORE_JSON), JSON.stringify(score, null, 2), "utf-8");
}

export function readCellScore(dir: string): CellScore | undefined {
  const p = join(dir, CELL_SCORE_JSON);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as CellScore) : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/cell.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/cell.ts eval/codegen-matrix/src/cell.test.ts
git commit -m "feat(eval): codegen-matrix cell types + path/slug/url helpers"
```

---

## Task 4: Deterministic rubric + drift guard

**Files:**

- Create: `eval/codegen-matrix/src/rubric.ts`
- Test: `eval/codegen-matrix/src/rubric.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rules, runRubric } from "./rubric.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = resolve(__dirname, "../../../prompts/pkg/system-prompt.md");

const passing = `import React, { useState } from "react";
import { useFireproof } from "use-fireproof";

const c = { page: "bg-slate-100", ink: "text-slate-900" };

export default function App() {
  const [n, setN] = useState(0);
  return (
    <div className={c.page}>
      <svg viewBox="0 0 24 24" width="24" height="24" />
      <button onClick={() => setN(n + 1)}>{n}</button>
    </div>
  );
}
`;

describe("runRubric", () => {
  it("passes a clean App.jsx", () => {
    const r = runRubric({ "App.jsx": passing });
    expect(r.failedRules).toEqual([]);
    expect(r.passed).toBe(r.total);
  });

  it("fails when export default is missing", () => {
    const r = runRubric({ "App.jsx": passing.replace("export default function App()", "function App()") });
    expect(r.failedRules).toContain("export-default-app");
  });

  it("fails on a raw bracket color in JSX className", () => {
    const r = runRubric({ "App.jsx": passing.replace("className={c.page}", 'className="bg-[#f1f5f9]"') });
    expect(r.failedRules).toContain("no-raw-bracket-colors");
  });

  it("fails on an emoji in the UI", () => {
    const r = runRubric({ "App.jsx": passing.replace(">{n}<", ">🚀{n}<") });
    expect(r.failedRules).toContain("no-emoji");
  });

  it("fails when access logic lives inside App.jsx (no access.js present)", () => {
    const withAccess = passing.replace("const [n, setN]", "function access(ctx) { return true; }\n  const [n, setN]");
    const r = runRubric({ "App.jsx": withAccess });
    expect(r.failedRules).toContain("access-in-separate-file");
  });
});

describe("rubric drift guard", () => {
  it("every rule's promptAnchor still appears in the system prompt", () => {
    const prompt = readFileSync(SYSTEM_PROMPT, "utf-8");
    const missing = rules.filter((rule) => !prompt.includes(rule.promptAnchor)).map((r) => r.name);
    expect(missing, `anchors missing from system-prompt.md: ${missing.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/rubric.test.ts`
Expected: FAIL — cannot find module `./rubric.js`.

- [ ] **Step 3: Write `src/rubric.ts`**

```ts
import type { RubricResult } from "./cell.js";

export interface RubricRule {
  /** Stable id used in failedRules + tests. */
  readonly name: string;
  /** Verbatim phrase from prompts/pkg/system-prompt.md this rule is derived from. */
  readonly promptAnchor: string;
  /** True = rule satisfied. `files` maps relative path -> contents. */
  readonly check: (files: Readonly<Record<string, string>>) => boolean;
}

function app(files: Readonly<Record<string, string>>): string {
  return files["App.jsx"] ?? files["/App.jsx"] ?? "";
}

// Emoji detection: pictographic ranges + variation selectors. Plain SVG/text passes.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

// A raw bracket color (bg-[#hex] / text-[#hex] / border-[#hex]) appearing inside a
// className attribute. The system prompt requires these to go through a classNames object.
const RAW_BRACKET_IN_CLASSNAME_RE = /className=(?:"|\{\s*"|\{\s*`)[^"`}]*\b(?:bg|text|border)-\[#[0-9a-fA-F]/;

export const rules: readonly RubricRule[] = [
  {
    name: "export-default-app",
    promptAnchor: "export default function App()",
    check: (f) => /export\s+default\s+function\s+App\s*\(/.test(app(f)),
  },
  {
    name: "es-imports-no-globals",
    promptAnchor: "Never reference React or other libraries as globals",
    check: (f) => /^\s*import\s.+from\s+["']/m.test(app(f)) && !/\bwindow\.React\b/.test(app(f)),
  },
  {
    name: "no-raw-bracket-colors",
    promptAnchor: "Never put raw bracket colors directly in JSX",
    check: (f) => !RAW_BRACKET_IN_CLASSNAME_RE.test(app(f)),
  },
  {
    name: "no-emoji",
    promptAnchor: "Never use emojis in the UI",
    check: (f) => !EMOJI_RE.test(app(f)),
  },
  {
    name: "access-in-separate-file",
    promptAnchor: "never put access function code inside",
    // If App.jsx declares an access function, that's a violation regardless of
    // whether access.js exists — access logic must live in access.js only.
    check: (f) => !/\b(?:function\s+access\s*\(|const\s+access\s*=)/.test(app(f)),
  },
];

export function runRubric(files: Readonly<Record<string, string>>): RubricResult {
  const failedRules = rules.filter((r) => !r.check(files)).map((r) => r.name);
  return { passed: rules.length - failedRules.length, total: rules.length, failedRules };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/rubric.test.ts`
Expected: PASS, including the drift guard (all anchors present in `prompts/pkg/system-prompt.md`).

> If the drift guard fails, an anchor phrase has been reworded in the system prompt. Update that rule's `promptAnchor` to a current verbatim phrase (and adjust `check` if the rule's intent changed) — do not delete the guard.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/rubric.ts eval/codegen-matrix/src/rubric.test.ts
git commit -m "feat(eval): codegen-matrix deterministic rubric + drift guard"
```

---

## Task 5: Screenshot readiness poller

**Files:**

- Create: `eval/codegen-matrix/src/readiness.ts`
- Test: `eval/codegen-matrix/src/readiness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { waitForScreenshot } from "./readiness.js";

function statusFetcher(statuses: number[]): (url: string) => Promise<{ status: number }> {
  let i = 0;
  return async () => ({ status: statuses[Math.min(i++, statuses.length - 1)] });
}

const noSleep = async () => {};

describe("waitForScreenshot", () => {
  it("resolves ready once a 200 is seen", async () => {
    const r = await waitForScreenshot("http://x/screenshot.jpg", {
      timeoutMs: 10_000,
      intervalMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 1000);
      })(),
      fetchStatus: statusFetcher([404, 404, 200]),
      sleep: noSleep,
    });
    expect(r.ready).toBe(true);
    expect(r.attempts).toBe(3);
  });

  it("gives up after the timeout when only 404s are seen", async () => {
    const r = await waitForScreenshot("http://x/screenshot.jpg", {
      timeoutMs: 3000,
      intervalMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 1000);
      })(),
      fetchStatus: statusFetcher([404]),
      sleep: noSleep,
    });
    expect(r.ready).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/readiness.test.ts`
Expected: FAIL — cannot find module `./readiness.js`.

- [ ] **Step 3: Write `src/readiness.ts`**

```ts
export interface ReadinessOpts {
  readonly timeoutMs: number;
  readonly intervalMs: number;
  /** Monotonic clock in ms (injectable for tests). */
  readonly now: () => number;
  /** Returns the HTTP status for a HEAD/GET of the URL. */
  readonly fetchStatus: (url: string) => Promise<{ status: number }>;
  readonly sleep: (ms: number) => Promise<void>;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly attempts: number;
}

const defaultFetchStatus = async (url: string): Promise<{ status: number }> => {
  const res = await fetch(url, { method: "GET" });
  return { status: res.status };
};

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Poll the screenshot URL until it returns 200 (ready) or the timeout elapses.
 * 404 = not ready yet (capture lags the deploy). The 200 transition is the
 * public projection of the server storing a `screen-shot-ref` in app meta.
 */
export async function waitForScreenshot(
  url: string,
  opts: Partial<ReadinessOpts> & Pick<ReadinessOpts, "timeoutMs">
): Promise<ReadinessResult> {
  const o: ReadinessOpts = {
    intervalMs: 3000,
    now: () => Date.now(),
    fetchStatus: defaultFetchStatus,
    sleep: defaultSleep,
    ...opts,
  };
  const start = o.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const { status } = await o.fetchStatus(url).catch(() => ({ status: 0 }));
    if (status === 200) return { ready: true, attempts };
    if (o.now() - start >= o.timeoutMs) return { ready: false, attempts };
    await o.sleep(o.intervalMs);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/readiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/readiness.ts eval/codegen-matrix/src/readiness.test.ts
git commit -m "feat(eval): codegen-matrix screenshot readiness poller"
```

---

## Task 6: Judges (`call-ai` feature + design)

**Files:**

- Create: `eval/codegen-matrix/src/judge.ts`
- Test: `eval/codegen-matrix/src/judge.test.ts`

Network calls are not unit-tested (mirrors `preamble-probe`); we unit-test only the pure `.dev.vars` parser and the prompt builders.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseDevVars, buildFeaturePrompt, buildDesignPrompt } from "./judge.js";

describe("parseDevVars", () => {
  it("extracts the LLM url + key", () => {
    const text = "FOO=bar\nLLM_BACKEND_URL=https://llm.example/v1/chat\nLLM_BACKEND_API_KEY=sk-123\n";
    expect(parseDevVars(text)).toEqual({ llmUrl: "https://llm.example/v1/chat", llmKey: "sk-123" });
  });
  it("throws when missing", () => {
    expect(() => parseDevVars("FOO=bar")).toThrow(/LLM_BACKEND/);
  });
});

describe("buildFeaturePrompt", () => {
  it("includes the user prompt and the App.jsx source", () => {
    const p = buildFeaturePrompt("build a todo", { "App.jsx": "export default function App(){}" });
    expect(p).toContain("build a todo");
    expect(p).toContain("export default function App");
  });
});

describe("buildDesignPrompt", () => {
  it("references the user prompt and the design dimensions", () => {
    const p = buildDesignPrompt("build a synth");
    expect(p).toContain("build a synth");
    expect(p).toMatch(/layout|hierarchy|contrast/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/judge.test.ts`
Expected: FAIL — cannot find module `./judge.js`.

- [ ] **Step 3: Write `src/judge.ts`**

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callAi, type CallAIOptions } from "call-ai";
import type { JudgeResult, DesignResult } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_VARS = resolve(__dirname, "../../../vibes.diy/pkg/.dev.vars");

export interface DevVars {
  readonly llmUrl: string;
  readonly llmKey: string;
}

export function parseDevVars(text: string): DevVars {
  const llmUrl = text.match(/^LLM_BACKEND_URL=(.+)$/m)?.[1]?.trim();
  const llmKey = text.match(/^LLM_BACKEND_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!llmUrl || !llmKey) {
    throw new Error(`LLM_BACKEND_URL / LLM_BACKEND_API_KEY missing in .dev.vars`);
  }
  return { llmUrl, llmKey };
}

export function readDevVars(): DevVars {
  return parseDevVars(readFileSync(DEV_VARS, "utf-8"));
}

const JUDGE_SCHEMA = {
  properties: {
    score: { type: "integer", description: "1 (poor) to 5 (excellent)" },
    reason: { type: "string", description: "one-line justification" },
  },
  required: ["score", "reason"],
};

export function buildFeaturePrompt(userPrompt: string, files: Readonly<Record<string, string>>): string {
  const app = files["App.jsx"] ?? files["/App.jsx"] ?? "";
  const access = files["access.js"] ?? files["/access.js"];
  const accessBlock = access ? `\n\n--- access.js ---\n${access}` : "";
  return [
    "You are grading whether a generated app fulfils the request. Score 1-5:",
    "5 = every requested feature is implemented and wired; 1 = the request is essentially unmet.",
    "",
    `REQUEST:\n${userPrompt}`,
    "",
    `--- App.jsx ---\n${app}${accessBlock}`,
  ].join("\n");
}

export function buildDesignPrompt(userPrompt: string): string {
  return [
    "You are grading the visual design quality of a screenshot of a generated web app. Score 1-5 on:",
    "layout, visual hierarchy, contrast/readability, overall polish, and adherence to a no-emoji icon style.",
    "5 = clean, considered, production-feeling; 1 = broken/unstyled.",
    "",
    `The app was generated from this request:\n${userPrompt}`,
  ].join("\n");
}

function clampScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function parseJudge(raw: unknown): { score: number | null; reason: string } {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const obj = JSON.parse(text) as { score?: unknown; reason?: unknown };
    return { score: clampScore(obj.score), reason: typeof obj.reason === "string" ? obj.reason : "" };
  } catch {
    return { score: null, reason: "judge returned unparseable output" };
  }
}

export interface JudgeDeps {
  readonly devVars: DevVars;
  readonly judgeModel: string;
}

export async function judgeFeature(
  userPrompt: string,
  files: Readonly<Record<string, string>>,
  deps: JudgeDeps
): Promise<JudgeResult> {
  const opts: CallAIOptions = {
    model: deps.judgeModel,
    endpoint: deps.devVars.llmUrl,
    apiKey: deps.devVars.llmKey,
    schema: { ...JUDGE_SCHEMA, required: [...JUDGE_SCHEMA.required] },
  };
  try {
    const raw = await callAi(buildFeaturePrompt(userPrompt, files), opts);
    const { score, reason } = parseJudge(raw);
    return { score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { score: null, reason: `judge call failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}

export async function judgeDesign(userPrompt: string, imageDataUrl: string, deps: JudgeDeps): Promise<DesignResult> {
  const opts: CallAIOptions = {
    model: deps.judgeModel,
    endpoint: deps.devVars.llmUrl,
    apiKey: deps.devVars.llmKey,
    schema: { ...JUDGE_SCHEMA, required: [...JUDGE_SCHEMA.required] },
  };
  // OpenAI/OpenRouter multimodal message shape: a text part + an image_url part.
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: buildDesignPrompt(userPrompt) },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
  try {
    const raw = await callAi(messages as unknown as string, opts);
    const { score, reason } = parseJudge(raw);
    return { available: true, score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { available: true, score: null, reason: `design judge failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/judge.test.ts`
Expected: PASS (only the pure helpers are exercised).

- [ ] **Step 5: Verify the call-ai multimodal shape during smoke (note, no code change here)**

The `judgeDesign` multimodal message array (`content: [{type:"text"}, {type:"image_url"}]`) is the OpenAI/OpenRouter convention. Confirm `call-ai`'s public type accepts a messages array during the Task 9 smoke run; if its signature differs, adjust the `callAi(messages, opts)` call only (the prompt builders and schema are unaffected).

- [ ] **Step 6: Commit**

```bash
git add eval/codegen-matrix/src/judge.ts eval/codegen-matrix/src/judge.test.ts
git commit -m "feat(eval): codegen-matrix call-ai feature + design judges"
```

---

## Task 7: Generate driver (Stage 2)

**Files:**

- Create: `eval/codegen-matrix/src/generate.ts`
- Test: `eval/codegen-matrix/src/generate.test.ts`

Unit-test the pure helpers (`promptHash`, arg assembly); the subprocess run is exercised in the Task 9 smoke.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { promptHash, buildGenerateArgs } from "./generate.js";

describe("promptHash", () => {
  it("is stable and hex", () => {
    expect(promptHash("build a todo")).toMatch(/^[0-9a-f]{64}$/);
    expect(promptHash("build a todo")).toBe(promptHash("build a todo"));
  });
});

describe("buildGenerateArgs", () => {
  it("assembles generate flags", () => {
    const args = buildGenerateArgs({
      model: "anthropic/claude-sonnet-4.6",
      handle: "eval",
      apiUrl: "https://vibes.diy/api",
      prompt: "build a todo",
    });
    expect(args).toEqual([
      "generate",
      "--model",
      "anthropic/claude-sonnet-4.6",
      "--handle",
      "eval",
      "--api-url",
      "https://vibes.diy/api",
      "build a todo",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/generate.test.ts`
Expected: FAIL — cannot find module `./generate.js`.

- [ ] **Step 3: Write `src/generate.ts`**

```ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseMatrixConfig, parsePromptsJsonl, type MatrixConfig, type ModelEntry, type PromptEntry } from "./config.js";
import { cellDirName, discoverAppSlug, writeCellJson, type CellJson, type RunJson, RUN_JSON } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");
const DEFAULT_PROMPTS = resolve(ROOT, "config/prompts.jsonl");
const RUNS_DIR = resolve(ROOT, "runs");

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf-8").digest("hex");
}

export function buildGenerateArgs(o: {
  readonly model: string;
  readonly handle: string;
  readonly apiUrl: string;
  readonly prompt: string;
}): string[] {
  return ["generate", "--model", o.model, "--handle", o.handle, "--api-url", o.apiUrl, o.prompt];
}

/** Split "npx vibes-diy@latest" into [cmd, ...prefixArgs]. */
function splitCli(cliCommand: string): { cmd: string; prefix: string[] } {
  const parts = cliCommand.trim().split(/\s+/);
  return { cmd: parts[0], prefix: parts.slice(1) };
}

function resolveCliVersion(cliCommand: string): string {
  const { cmd, prefix } = splitCli(cliCommand);
  const r = spawnSync(cmd, [...prefix, "--version"], { encoding: "utf-8" });
  return (r.stdout ?? "").trim() || "unknown";
}

function gitCommitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  return (r.stdout ?? "").trim() || "unknown";
}

function subdirs(dir: string): string[] {
  return readdirSync(dir).filter((name) => {
    try {
      return statSync(join(dir, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

function runCell(args: {
  readonly cfg: MatrixConfig;
  readonly model: ModelEntry;
  readonly prompt: PromptEntry;
  readonly rep: number;
  readonly runDir: string;
  readonly cliVersion: string;
}): void {
  const { cfg, model, prompt, rep, runDir, cliVersion } = args;
  const cellDir = join(runDir, cellDirName(prompt.id, model.id, rep));
  mkdirSync(cellDir, { recursive: true });
  const { cmd, prefix } = splitCli(cfg.cliCommand);
  const cliArgs = [
    ...prefix,
    ...buildGenerateArgs({ model: model.id, handle: cfg.handle, apiUrl: cfg.apiUrl, prompt: prompt.prompt }),
  ];

  const t0 = Date.now();
  const res = spawnSync(cmd, cliArgs, { cwd: cellDir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const latencyMs = Date.now() - t0;

  const created = subdirs(cellDir);
  const appSlug = discoverAppSlug(created);
  const stderrTail = (res.stderr ?? "").split("\n").slice(-20).join("\n");
  const exitState: CellJson["exitState"] = res.status === 0 && appSlug !== undefined ? "ok" : "generate-failed";

  const cell: CellJson = {
    promptId: prompt.id,
    model: model.id,
    class: model.class,
    tier: model.tier,
    rep,
    appSlug: appSlug ?? "",
    ownerHandle: cfg.handle,
    directory: appSlug ? join(cellDir, appSlug) : "",
    latencyMs,
    exitState,
    stderrTail,
    apiUrl: cfg.apiUrl,
    cliVersion,
    promptHash: promptHash(prompt.prompt),
  };
  writeCellJson(cellDir, cell);
  stderr.write(`  ${prompt.id} ${model.id} r${rep}: ${exitState} ${latencyMs}ms ${appSlug ?? "(no app)"}\n`);
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

export async function main(): Promise<void> {
  const cfg = parseMatrixConfig(readFileSync(parseFlag("--matrix") ?? DEFAULT_MATRIX, "utf-8"));
  const prompts = parsePromptsJsonl(readFileSync(parseFlag("--prompts") ?? DEFAULT_PROMPTS, "utf-8"));
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = join(RUNS_DIR, ts);
  mkdirSync(runDir, { recursive: true });

  const cliVersion = resolveCliVersion(cfg.cliCommand);
  const run: RunJson = {
    startedAt: new Date().toISOString(),
    apiUrl: cfg.apiUrl,
    cliCommand: cfg.cliCommand,
    cliVersion,
    commitSha: gitCommitSha(),
    judgeModel: cfg.judgeModel,
    reps: cfg.reps,
    promptsHash: promptHash(prompts.map((p) => `${p.id}:${p.prompt}`).join("\n")),
  };
  writeFileSync(join(runDir, RUN_JSON), JSON.stringify(run, null, 2), "utf-8");

  const total = cfg.models.length * prompts.length * cfg.reps;
  stderr.write(`codegen-matrix: ${total} cells -> ${runDir}\n`);
  // Sequential: parallelizing risks rate-limit noise in results.
  for (const model of cfg.models) {
    for (const prompt of prompts) {
      for (let rep = 0; rep < cfg.reps; rep++) {
        runCell({ cfg, model, prompt, rep, runDir, cliVersion });
      }
    }
  }
  stderr.write(`done. run dir: ${runDir}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`generate failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/generate.ts eval/codegen-matrix/src/generate.test.ts
git commit -m "feat(eval): codegen-matrix generate driver (stage 2)"
```

---

## Task 8: Score orchestrator (Stage 3)

**Files:**

- Create: `eval/codegen-matrix/src/score.ts`
- Test: `eval/codegen-matrix/src/score.test.ts`

We unit-test the pure file-collection + data-URL helpers; the full scoring run (judges + network) is exercised in the Task 9 smoke.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectSourceFiles, toDataUrl } from "./score.js";

describe("collectSourceFiles", () => {
  it("reads code files but skips README and non-source", () => {
    const dir = mkdtempSync(join(tmpdir(), "cm-src-"));
    writeFileSync(join(dir, "App.jsx"), "export default function App(){}");
    writeFileSync(join(dir, "access.js"), "export function access(){}");
    writeFileSync(join(dir, "README.md"), "# readme");
    const files = collectSourceFiles(dir);
    expect(Object.keys(files).sort()).toEqual(["App.jsx", "access.js"]);
  });
});

describe("toDataUrl", () => {
  it("builds a base64 data url", () => {
    expect(toDataUrl(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe("data:image/jpeg;base64,AQID");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/score.test.ts`
Expected: FAIL — cannot find module `./score.js`.

- [ ] **Step 3: Write `src/score.ts`**

```ts
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { readCellJson, writeCellScore, screenshotUrl, type CellJson, type CellScore, CELL_JSON } from "./cell.js";
import { runRubric } from "./rubric.js";
import { readDevVars, judgeFeature, judgeDesign, type JudgeDeps } from "./judge.js";
import { waitForScreenshot } from "./readiness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "..", "runs");

const SOURCE_EXTS = new Set([".jsx", ".js", ".tsx", ".ts", ".css"]);

/** Read the generated source files (App.jsx, access.js, …) from a cell's app directory. */
export function collectSourceFiles(directory: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    if (name === "README.md") continue;
    if (!SOURCE_EXTS.has(extname(name))) continue;
    out[name] = readFileSync(join(directory, name), "utf-8");
  }
  return out;
}

export function toDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function fetchImage(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function scoreCell(args: {
  readonly cellDir: string;
  readonly cell: CellJson;
  readonly userPrompt: string;
  readonly judgeDeps: JudgeDeps;
  readonly screenshotTimeoutMs: number;
}): Promise<void> {
  const { cellDir, cell, userPrompt, judgeDeps, screenshotTimeoutMs } = args;
  const files = collectSourceFiles(cell.directory);
  const rubric = runRubric(files);
  const feature = await judgeFeature(userPrompt, files, judgeDeps);

  const shotUrl = screenshotUrl(cell.apiUrl, cell.appSlug, cell.ownerHandle);
  const readiness = await waitForScreenshot(shotUrl, { timeoutMs: screenshotTimeoutMs });
  let design: CellScore["design"];
  if (!readiness.ready) {
    design = { available: false, score: null, reason: "screenshot not ready before timeout", judgeModel: judgeDeps.judgeModel };
  } else {
    const bytes = await fetchImage(shotUrl);
    design = bytes
      ? await judgeDesign(userPrompt, toDataUrl(bytes, "image/jpeg"), judgeDeps)
      : { available: false, score: null, reason: "screenshot fetch failed", judgeModel: judgeDeps.judgeModel };
  }

  const score: CellScore = { promptId: cell.promptId, model: cell.model, rep: cell.rep, rubric, feature, design };
  writeCellScore(cellDir, score);
  stderr.write(
    `  scored ${cell.promptId} ${cell.model} r${cell.rep}: rubric=${rubric.passed}/${rubric.total} feature=${feature.score} design=${design.score}\n`
  );
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

function latestRunDir(): string {
  const dirs = readdirSync(RUNS_DIR)
    .filter((n) => n !== ".gitignore")
    .sort();
  if (dirs.length === 0) throw new Error(`no runs under ${RUNS_DIR}`);
  return join(RUNS_DIR, dirs[dirs.length - 1]);
}

async function main(): Promise<void> {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const promptsPath = parseFlag("--prompts") ?? resolve(__dirname, "..", "config/prompts.jsonl");
  const judgeModelOverride = parseFlag("--judge-model");
  // Map promptId -> prompt text for the judges.
  const promptText = new Map<string, string>();
  for (const line of readFileSync(promptsPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim())) {
    const e = JSON.parse(line) as { id: string; prompt: string };
    promptText.set(e.id, e.prompt);
  }
  const judgeDeps: JudgeDeps = {
    devVars: readDevVars(),
    judgeModel: judgeModelOverride ?? "anthropic/claude-opus-4.5",
  };
  // screenshotTimeoutMs lives in run.json's sibling matrix; read from matrix config.
  const matrix = JSON.parse(readFileSync(resolve(__dirname, "..", "config/matrix.json"), "utf-8")) as {
    screenshotTimeoutMs: number;
    judgeModel: string;
  };
  if (!judgeModelOverride) judgeDeps.judgeModel = matrix.judgeModel;

  const cellDirs = readdirSync(runDir).filter((n) => existsSync(join(runDir, n, CELL_JSON)));
  stderr.write(`scoring ${cellDirs.length} cell(s) in ${runDir}\n`);
  for (const name of cellDirs) {
    const cellDir = join(runDir, name);
    const cell = readCellJson(cellDir);
    if (!cell || cell.exitState !== "ok") {
      stderr.write(`  skip ${name}: ${cell?.exitState ?? "no cell.json"}\n`);
      continue;
    }
    const userPrompt = promptText.get(cell.promptId) ?? "";
    await scoreCell({ cellDir, cell, userPrompt, judgeDeps, screenshotTimeoutMs: matrix.screenshotTimeoutMs });
  }
  stderr.write(`done scoring ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`score failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add eval/codegen-matrix/src/score.ts eval/codegen-matrix/src/score.test.ts
git commit -m "feat(eval): codegen-matrix score orchestrator (stage 3)"
```

---

## Task 9: Report (Stage 4) + config files + README + smoke

**Files:**

- Create: `eval/codegen-matrix/src/report.ts`
- Test: `eval/codegen-matrix/src/report.test.ts`
- Create: `eval/codegen-matrix/config/matrix.json`
- Create: `eval/codegen-matrix/config/prompts.jsonl`
- Create: `eval/codegen-matrix/README.md`

- [ ] **Step 1: Write the failing test** (`src/report.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { median, buildRows, renderSummary, type JoinedCell } from "./report.js";

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("buildRows", () => {
  const cells: JoinedCell[] = [
    {
      promptId: "todo",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 0,
      latencyMs: 1000,
      exitState: "ok",
      rubricRatio: 1,
      featureScore: 5,
      designScore: 4,
    },
    {
      promptId: "todo",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 1,
      latencyMs: 3000,
      exitState: "ok",
      rubricRatio: 0.8,
      featureScore: 4,
      designScore: 4,
    },
    {
      promptId: "todo",
      model: "m2",
      class: "c",
      tier: "expensive",
      rep: 0,
      latencyMs: 5000,
      exitState: "generate-failed",
      rubricRatio: null,
      featureScore: null,
      designScore: null,
    },
  ];

  it("aggregates reps per (model, prompt)", () => {
    const rows = buildRows(cells);
    const m1 = rows.find((r) => r.model === "m1" && r.promptId === "todo");
    expect(m1?.medianLatencyMs).toBe(2000);
    expect(m1?.meanRubric).toBeCloseTo(0.9);
  });

  it("keeps a failed cell visible with null metrics", () => {
    const rows = buildRows(cells);
    const m2 = rows.find((r) => r.model === "m2");
    expect(m2?.medianLatencyMs).toBe(5000);
    expect(m2?.meanFeature).toBeNull();
  });
});

describe("renderSummary", () => {
  it("emits a markdown table with a header", () => {
    const md = renderSummary(
      buildRows([
        {
          promptId: "todo",
          model: "m1",
          class: "c",
          tier: "cheap",
          rep: 0,
          latencyMs: 1000,
          exitState: "ok",
          rubricRatio: 1,
          featureScore: 5,
          designScore: 4,
        },
      ])
    );
    expect(md).toContain("| model |");
    expect(md).toContain("m1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/report.test.ts`
Expected: FAIL — cannot find module `./report.js`.

- [ ] **Step 3: Write `src/report.ts`**

```ts
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { readCellJson, readCellScore, CELL_JSON } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "..", "runs");

export interface JoinedCell {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly rep: number;
  readonly latencyMs: number;
  readonly exitState: "ok" | "generate-failed";
  readonly rubricRatio: number | null;
  readonly featureScore: number | null;
  readonly designScore: number | null;
}

export interface Row {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly reps: number;
  readonly medianLatencyMs: number;
  readonly meanRubric: number | null;
  readonly meanFeature: number | null;
  readonly meanDesign: number | null;
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: readonly (number | null)[]): number | null {
  const vals = xs.filter((x): x is number => x !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function buildRows(cells: readonly JoinedCell[]): Row[] {
  const groups = new Map<string, JoinedCell[]>();
  for (const c of cells) {
    const key = `${c.model} ${c.promptId}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }
  const rows: Row[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    rows.push({
      promptId: first.promptId,
      model: first.model,
      class: first.class,
      tier: first.tier,
      reps: group.length,
      medianLatencyMs: median(group.map((g) => g.latencyMs)),
      meanRubric: mean(group.map((g) => g.rubricRatio)),
      meanFeature: mean(group.map((g) => g.featureScore)),
      meanDesign: mean(group.map((g) => g.designScore)),
    });
  }
  return rows.sort((a, b) => a.model.localeCompare(b.model) || a.promptId.localeCompare(b.promptId));
}

function fmt(n: number | null, digits = 2): string {
  return n === null || Number.isNaN(n) ? "—" : n.toFixed(digits);
}

export function renderSummary(rows: readonly Row[]): string {
  const header = "| model | class | tier | prompt | reps | median ms | rubric | feature | design |";
  const sep = "| --- | --- | --- | --- | --: | --: | --: | --: | --: |";
  const body = rows.map(
    (r) =>
      `| ${r.model} | ${r.class} | ${r.tier} | ${r.promptId} | ${r.reps} | ${r.medianLatencyMs} | ${fmt(r.meanRubric)} | ${fmt(r.meanFeature)} | ${fmt(r.meanDesign)} |`
  );
  return [`# codegen-matrix summary`, "", header, sep, ...body, ""].join("\n");
}

function joinCells(runDir: string): JoinedCell[] {
  const out: JoinedCell[] = [];
  for (const name of readdirSync(runDir)) {
    const cellDir = join(runDir, name);
    if (!existsSync(join(cellDir, CELL_JSON))) continue;
    const cell = readCellJson(cellDir);
    if (!cell) continue;
    const score = readCellScore(cellDir); // may be undefined for failed/unscored cells
    out.push({
      promptId: cell.promptId,
      model: cell.model,
      class: cell.class,
      tier: cell.tier,
      rep: cell.rep,
      latencyMs: cell.latencyMs,
      exitState: cell.exitState,
      rubricRatio: score ? score.rubric.passed / score.rubric.total : null,
      featureScore: score?.feature.score ?? null,
      designScore: score?.design.score ?? null,
    });
  }
  return out;
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

function latestRunDir(): string {
  const dirs = readdirSync(RUNS_DIR)
    .filter((n) => n !== ".gitignore")
    .sort();
  if (dirs.length === 0) throw new Error(`no runs under ${RUNS_DIR}`);
  return join(RUNS_DIR, dirs[dirs.length - 1]);
}

function main(): void {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const cells = joinCells(runDir);
  writeFileSync(join(runDir, "index.jsonl"), cells.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf-8");
  writeFileSync(join(runDir, "summary.md"), renderSummary(buildRows(cells)), "utf-8");
  stderr.write(`wrote index.jsonl + summary.md to ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run --project eval-codegen-matrix src/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `config/matrix.json`**

```json
{
  "cliCommand": "npx vibes-diy@latest",
  "apiUrl": "https://vibes.diy/api?.stable-entry.=cli",
  "handle": "eval",
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 3,
  "screenshotTimeoutMs": 120000,
  "models": [
    { "id": "anthropic/claude-opus-4.6-fast", "class": "anthropic", "tier": "expensive" },
    { "id": "anthropic/claude-sonnet-4.6", "class": "anthropic", "tier": "cheap" },
    { "id": "google/gemini-3.1-pro-preview", "class": "google", "tier": "expensive" },
    { "id": "google/gemini-2.5-flash-lite", "class": "google", "tier": "cheap" },
    { "id": "openai/gpt-5.5", "class": "openai", "tier": "expensive" },
    { "id": "openai/gpt-oss-20b", "class": "openai", "tier": "cheap" },
    { "id": "qwen/qwen3-coder-plus", "class": "qwen", "tier": "expensive" },
    { "id": "qwen/qwen3-235b-a22b-2507", "class": "qwen", "tier": "cheap" },
    { "id": "deepseek/deepseek-chat-v3.1", "class": "deepseek", "tier": "expensive" },
    { "id": "deepseek/deepseek-v3.2", "class": "deepseek", "tier": "cheap" },
    { "id": "mistralai/mistral-nemo", "class": "mistral", "tier": "cheap" }
  ]
}
```

- [ ] **Step 6: Create `config/prompts.jsonl`**

```jsonl
{"id":"collab-lists","prompt":"Multi-list todo app. A list creator sees only their own lists and can invite collaborators per list; invited collaborators see only the lists shared with them. Persist lists, items, and per-list membership in Fireproof."}
{"id":"audio-synth","prompt":"Web Audio synthesizer with a playable keyboard and an ADSR envelope (attack/decay/sustain/release sliders) that shapes each note. No external audio libraries."}
{"id":"recipe-shop","prompt":"Recipe to smart shopping list. Enter a recipe; use callAI with a JSON schema to extract ingredients into structured docs; tapping an item toggles 'have it' with optimistic Fireproof writes and a per-row saving cue; a button uses callAI to suggest substitutions."}
```

- [ ] **Step 7: Create `README.md`**

````markdown
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
  non-prod, a confirmation set on prod), `handle`, `judgeModel`, `reps`,
  `screenshotTimeoutMs`, and the `models` list (cheapest + priciest per class).
- `config/prompts.jsonl` — one `{id, prompt}` per line.

## Notes

- Runs are sequential to avoid rate-limit noise in results.
- The rubric's rules each declare a `promptAnchor`; a vitest drift guard fails
  if an anchor stops appearing in `prompts/pkg/system-prompt.md`, so a reworded
  system prompt can't silently invalidate adherence scores.
````

- [ ] **Step 8: Full test pass + smoke**

Run: `pnpm exec vitest --run --project eval-codegen-matrix`
Expected: PASS (all suites).

Then a **single-cell smoke** (one model, one prompt, one rep) to validate the live path end-to-end, including the `call-ai` multimodal shape from Task 6:

```sh
cd eval/codegen-matrix
# temporary 1×1×1 config
printf '{"id":"todo","prompt":"Build a simple todo list. Persist todos in Fireproof."}\n' > /tmp/cm-smoke-prompts.jsonl
pnpm run generate -- --prompts /tmp/cm-smoke-prompts.jsonl --matrix config/matrix.json
pnpm run score
pnpm run report
```

Expected: a `runs/<ts>/` with `run.json`, one `cell.json` (`exitState: "ok"`),
one `cell.score.json` (rubric + feature + design populated, design may be
`available:false` if the screenshot lagged past the timeout), `index.jsonl`,
and `summary.md`. If `judgeDesign`'s `callAi(messages, opts)` errors on the
message shape, adjust that single call to `call-ai`'s actual multimodal
signature and re-run `score`.

> The smoke run deploys a real vibe under the `eval` handle and spends judge
> tokens — expected and acceptable per the spec. Reduce `reps` to 1 for smokes.

- [ ] **Step 9: Commit**

```bash
git add eval/codegen-matrix/src/report.ts eval/codegen-matrix/src/report.test.ts \
        eval/codegen-matrix/config eval/codegen-matrix/README.md
git commit -m "feat(eval): codegen-matrix report (stage 4) + config + README"
```

---

## Self-Review

**Spec coverage:**

- Stage 1 config (apiUrl, models, prompts, provenance fields) → Task 2 + Task 9 config files. ✓
- Stage 2 create loop via CLI, filesystem discovery (not stdout), `cell.json` + `run.json`, provenance → Task 7. ✓
- Stage 3 speed (latency from cell.json), deterministic rubric, feature judge, design judge w/ readiness → Tasks 4, 5, 6, 8. ✓
- Stage 4 report joining on `cell.json` left-joined with `cell.score.json` (failed cells visible) → Task 9 (`joinCells` reads `cell.json` spine; `readCellScore` may be undefined). ✓
- Rubric drift guard → Task 4. ✓
- Judge transport via `call-ai` + `.dev.vars` → Task 6. ✓
- Repeatability (one-line model add, re-score without re-generate) → stages read latest/`--run` dir independently; config-driven models. ✓
- Testing section (config, rubric+drift, cell, manual smoke for network) → Tasks 2,3,4,5,6,7,8,9. ✓
- Out of scope (cost, multi-turn, CI gating) → not implemented. ✓

**Type consistency:** `CellJson`, `CellScore`, `RubricResult`, `JudgeResult`, `DesignResult`, `RunJson` defined once in `cell.ts` and imported everywhere. `JudgeDeps` defined in `judge.ts`, consumed in `score.ts`. `JoinedCell`/`Row` local to `report.ts`. `screenshotUrl`/`discoverAppSlug`/`cellDirName`/`modelSlug` defined in `cell.ts`, used in `generate.ts`/`score.ts`. Consistent.

**Placeholder scan:** No TBD/TODO; every code step is complete. The only deferred decision (call-ai multimodal signature) is isolated to one call with an explicit smoke-verification step.
