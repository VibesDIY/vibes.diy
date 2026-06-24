# Access-Model Codegen Autoresearch Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable eval harness (`eval/access-model`) that drives `vibes-diy generate` over the #2588 8-prompt matrix (+ a hidden holdout) on the pinned default codegen model, statically grades `access.js`/`App.jsx` for the access-model invariants, runs one "second signed-in visitor" LLM judge, computes a composite PASS/SOFT/FAIL metric, enforces 5 discard-gates, and exposes a single `Verify` shell command so `/autoresearch` can iterate the `prompts/pkg/` corpus and keep/discard against the metric.

**Architecture:** A new private package `eval/access-model` sits beside `eval/codegen-matrix` and **reuses** the latter's generate driver, concurrency pool, retry/backoff, run-dir helpers, judge transport, and dev-vars resolution by importing them via relative paths (both run under `tsx`; do **not** modify `codegen-matrix`). The novel surface is the access-specific static grader (`invariants.ts`), the grade composition (`grade.ts`), the composite metric (`metric.ts`), the renderability checks (`renderable.ts`), the second-visitor judge (`judge.ts`), the design-doc guardrail (`guardrail.ts`), the 5 verify gates (`gates.ts`), and one orchestrating `verify.ts` that prints `METRIC=<x>` and exits non-zero on any gate failure. The grader is **static-first** (greppable invariants over `access.js`), reserving the LLM judge for the single semantic question. The metric and gates are **pure functions** so they're unit-testable without the network; only `generate`/`score`/`verify` touch the CLI and LLM backend.

**Tech Stack:** TypeScript run via `tsx`, `vitest` for unit tests, the `call-ai` workspace package for the judge transport (`LLM_BACKEND_URL`/`LLM_BACKEND_API_KEY`), the published `vibes-diy` CLI for generation. Reuses `@vibes.diy/eval-codegen-matrix` internals.

**Reference material (read before starting):**
- Issue spec: VibesDIY/vibes.diy#2602 (the loop, scope, metric, 5 verify gates, concurrency, the 8-prompt matrix, the baseline).
- Eval playbook + pass criteria: #2588. Hand-graded corpus + grades: `vibes/eval/access-model-2588/README.md` and `docs/superpowers/specs/eval-2588-access-model-results-2026-06-24.json` (this JSON is the **output schema** `report.ts` must emit).
- Access-model grammar the grader encodes: `docs/superpowers/specs/2026-06-24-vibe-access-model-design.md` §3 (Form-A trap + A/B/C/D shape taxonomy), §4 (channels=objects / roles=types; see vs do), §5 (owner dissolved, reserved `owner` role, no `isOwner`), §6–7 (per-object reduce/projection mechanics).
- Reusable harness map: `eval/codegen-matrix/src/{generate,cell,pool,backoff,config,report,judge,readiness,score}.ts`. Match its intra-package import extension convention when importing across packages (check `eval/codegen-matrix/src/score.ts` imports first).
- Autoresearch contract: `.claude/skills/autoresearch/SKILL.md` (classic loop needs `Verify:` = exact shell command emitting a metric) and `agents/autoresearch-outer-loop.md`.

---

## File Structure

```
eval/access-model/
  package.json            # @vibes.diy/eval-access-model; scripts: generate/score/report/verify/test
  tsconfig.json           # extends ../../tsconfig.json (mirror codegen-matrix)
  vitest.config.ts        # name: eval-access-model; include src/**/*.test.ts
  README.md               # runbook (Task 16)
  config/
    matrix.json           # apiUrl, handle, runtimeHostBase, reps, concurrency, judgeModel, model pin
    prompts.eval.jsonl    # the 8 #2588 prompts: {id, prompt, dimension, expect}
    prompts.holdout.jsonl # 8 holdout prompts spanning the same 8 dimensions (hidden from modify step)
  src/
    config.ts        # parse access-matrix config + prompt entries (PURE)
    model.ts         # resolveDefaultModel(): pin the default coding model id (PURE-ish: reads env)
    invariants.ts    # static grader: regex/text invariants over access.js + App.jsx (PURE)
    renderable.ts    # App.jsx parse / dup-import / two-file emission checks (PURE)
    grade.ts         # compose invariants + judge verdict -> PASS/SOFT/FAIL per row (PURE)
    metric.ts        # composite mean(PASS=1/SOFT=.5/FAIL=0) + per-matrix aggregation (PURE)
    judge.ts         # the one second-visitor LLM judge (reuses codegen-matrix judge transport)
    guardrail.ts     # design-doc guardrail over a prompt DIFF: grep + small judge (PURE grep + judge)
    gates.ts         # the 5 verify discard-gates -> {pass, failed[]} (PURE)
    generate.ts      # access generate driver: pinned default model, pulls access.js+App.jsx (reuses pool/backoff/cell)
    score.ts         # stage: read run cells -> invariants+renderable+judge -> cell.score.json
    report.ts        # stage: aggregate -> results.json (#2593 schema) + access-summary.md + METRIC
    baseline.ts      # capture/read the baseline run summary used by the >=baseline gates (PURE I/O)
    verify.ts        # THE Verify command: check -> generate -> score -> report -> gates; prints METRIC
```

**Reuse imports (do not modify codegen-matrix):** from `../../codegen-matrix/src/pool` → `mapWithConcurrency`; `../../codegen-matrix/src/generate` → `runWithRetries`, `summarizeReason`; `../../codegen-matrix/src/cell` → `discoverAppSlug`, `cellDirName`, `writeCellJson`, run-dir constants; `../../codegen-matrix/src/judge` → `resolveDevVars`, `readDevVars`, the `call-ai` call wrapper; `../../codegen-matrix/src/report` → `median`. Add `"@vibes.diy/eval-codegen-matrix": "workspace:*"` to `package.json` deps so pnpm wires the workspace; import by relative path under `tsx`.

---

## Task 0: Scaffold the package

**Files:**
- Create: `eval/access-model/package.json`
- Create: `eval/access-model/tsconfig.json`
- Create: `eval/access-model/vitest.config.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@vibes.diy/eval-access-model",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Access-model codegen eval: grade generated access.js/App.jsx against the #2588 access model and drive the autoresearch prompt loop.",
  "scripts": {
    "generate": "tsx src/generate.ts",
    "score": "tsx src/score.ts",
    "report": "tsx src/report.ts",
    "verify": "tsx src/verify.ts",
    "test": "vitest --run"
  },
  "dependencies": {
    "@vibes.diy/eval-codegen-matrix": "workspace:*",
    "call-ai": "workspace:*",
    "tsx": "^4.22.4"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (mirror `eval/codegen-matrix/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "../../" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`** (mirror codegen-matrix)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval-access-model",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/runs/**"],
  },
});
```

- [ ] **Step 4: Wire the workspace** — run `pnpm install` at repo root so the new package + its `workspace:*` deps resolve.

Run: `pnpm install`
Expected: completes; `eval/access-model` appears in the workspace.

- [ ] **Step 5: Commit**

```bash
git add eval/access-model/package.json eval/access-model/tsconfig.json eval/access-model/vitest.config.ts pnpm-lock.yaml
git commit -m "eval(access-model): scaffold package"
```

---

## Task 1: Prompt + matrix config

**Files:**
- Create: `eval/access-model/config/prompts.eval.jsonl`
- Create: `eval/access-model/config/prompts.holdout.jsonl`
- Create: `eval/access-model/config/matrix.json`
- Create: `eval/access-model/src/config.ts`
- Test: `eval/access-model/src/config.test.ts`

The `expect` field tags each prompt with its dimension so the grader knows which invariants apply. Dimensions (verbatim ids used across the codebase): `per-visitor` (rows 1–2), `per-object` (rows 3–4), `owner-published` (row 5), `author-owned` (rows 6–7), `multi-tier` (row 8).

- [ ] **Step 1: Write `config/prompts.eval.jsonl`** (the #2588 matrix, one JSON object per line)

```jsonl
{"id":"todo","prompt":"A todo list app","dimension":"the Form-A test — sounds single-user, must be per-visitor","expect":"per-visitor"}
{"id":"habit","prompt":"A daily habit tracker","dimension":"per-visitor private","expect":"per-visitor"}
{"id":"shop","prompt":"A shared shopping list I can invite my partner to","dimension":"per-object collaboration","expect":"per-object"}
{"id":"board","prompt":"A collaborative whiteboard people can join","dimension":"per-object membership + join path","expect":"per-object"}
{"id":"blog","prompt":"My personal blog","dimension":"owner-published","expect":"owner-published"}
{"id":"guest","prompt":"A public guestbook anyone can sign","dimension":"author-owned + public read","expect":"author-owned"}
{"id":"photo","prompt":"A photo wall where people comment on posts","dimension":"author-owned comments","expect":"author-owned"}
{"id":"team","prompt":"A team workspace with channels and roles","dimension":"the 3+ tier edge","expect":"multi-tier"}
```

- [ ] **Step 2: Write `config/prompts.holdout.jsonl`** (8 *different* prompts spanning the same 8 dimensions — never shown to the modify step)

```jsonl
{"id":"h-notes","prompt":"A quick notes app","dimension":"Form-A test","expect":"per-visitor"}
{"id":"h-water","prompt":"A water-intake tracker","dimension":"per-visitor private","expect":"per-visitor"}
{"id":"h-trip","prompt":"A trip packing list I can share with my travel buddy","dimension":"per-object collaboration","expect":"per-object"}
{"id":"h-mood","prompt":"A shared mood board a group can contribute to","dimension":"per-object membership + join path","expect":"per-object"}
{"id":"h-portfolio","prompt":"My photography portfolio","dimension":"owner-published","expect":"owner-published"}
{"id":"h-wishes","prompt":"A public wish wall anyone can post to","dimension":"author-owned + public read","expect":"author-owned"}
{"id":"h-recipes","prompt":"A recipe site where people leave reviews","dimension":"author-owned comments","expect":"author-owned"}
{"id":"h-club","prompt":"A club site with members and organizers","dimension":"the 3+ tier edge","expect":"multi-tier"}
```

- [ ] **Step 3: Write `config/matrix.json`** (reps=8, concurrency=32 per the issue; `model` empty string ⇒ pin to the resolved default at kickoff — see Task 2)

```json
{
  "cliCommand": "npx vibes-diy@latest",
  "apiUrl": "https://vibes.diy/api?.stable-entry.=cli",
  "runtimeHostBase": "vibes.diy",
  "handle": "eval",
  "model": "",
  "judgeModel": "anthropic/claude-opus-4.5",
  "reps": 8,
  "concurrency": 32,
  "scoreConcurrency": 8,
  "screenshotTimeoutMs": 120000
}
```

- [ ] **Step 4: Write the failing test `src/config.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseAccessMatrix, parseAccessPrompts } from "./config.js";

describe("parseAccessPrompts", () => {
  it("parses id/prompt/dimension/expect per line and skips blanks", () => {
    const text = `{"id":"todo","prompt":"A todo list app","dimension":"d","expect":"per-visitor"}\n\n`;
    const rows = parseAccessPrompts(text);
    expect(rows).toEqual([{ id: "todo", prompt: "A todo list app", dimension: "d", expect: "per-visitor" }]);
  });
  it("rejects an unknown expect value", () => {
    const text = `{"id":"x","prompt":"p","dimension":"d","expect":"bogus"}`;
    expect(() => parseAccessPrompts(text)).toThrow(/expect/);
  });
});

describe("parseAccessMatrix", () => {
  it("clamps concurrency/reps defaults and keeps the empty model pin", () => {
    const cfg = parseAccessMatrix(`{"apiUrl":"a","handle":"eval","runtimeHostBase":"vibes.diy","model":"","judgeModel":"j"}`);
    expect(cfg.reps).toBe(8);
    expect(cfg.concurrency).toBe(32);
    expect(cfg.model).toBe("");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd eval/access-model && pnpm exec vitest --run src/config.test.ts`
Expected: FAIL — `./config.js` not found.

- [ ] **Step 6: Implement `src/config.ts`**

```ts
export type Dimension = "per-visitor" | "per-object" | "owner-published" | "author-owned" | "multi-tier";
const DIMENSIONS: ReadonlySet<string> = new Set([
  "per-visitor", "per-object", "owner-published", "author-owned", "multi-tier",
]);

export interface AccessPrompt {
  readonly id: string;
  readonly prompt: string;
  readonly dimension: string;
  readonly expect: Dimension;
}

export interface AccessMatrix {
  readonly cliCommand: string;
  readonly apiUrl: string;
  readonly runtimeHostBase: string;
  readonly handle: string;
  readonly model: string; // "" => pin to resolved default at kickoff
  readonly judgeModel: string;
  readonly reps: number;
  readonly concurrency: number;
  readonly scoreConcurrency: number;
  readonly screenshotTimeoutMs: number;
}

export function parseAccessPrompts(text: string): AccessPrompt[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const o = JSON.parse(line);
      if (!DIMENSIONS.has(o.expect)) throw new Error(`bad expect value: ${o.expect}`);
      if (typeof o.id !== "string" || typeof o.prompt !== "string") throw new Error(`bad prompt row: ${line}`);
      return { id: o.id, prompt: o.prompt, dimension: String(o.dimension ?? ""), expect: o.expect as Dimension };
    });
}

export function parseAccessMatrix(text: string): AccessMatrix {
  const o = JSON.parse(text);
  const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  for (const k of ["apiUrl", "handle", "runtimeHostBase", "judgeModel"]) {
    if (typeof o[k] !== "string" || !o[k]) throw new Error(`matrix.${k} must be a non-empty string`);
  }
  return {
    cliCommand: typeof o.cliCommand === "string" && o.cliCommand ? o.cliCommand : "npx vibes-diy@latest",
    apiUrl: o.apiUrl, runtimeHostBase: o.runtimeHostBase, handle: o.handle,
    model: typeof o.model === "string" ? o.model : "",
    judgeModel: o.judgeModel,
    reps: num(o.reps, 8), concurrency: num(o.concurrency, 32), scoreConcurrency: num(o.scoreConcurrency, 8),
    screenshotTimeoutMs: num(o.screenshotTimeoutMs, 120000),
  };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd eval/access-model && pnpm exec vitest --run src/config.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add eval/access-model/config eval/access-model/src/config.ts eval/access-model/src/config.test.ts
git commit -m "eval(access-model): matrix + prompt config (eval + holdout)"
```

---

## Task 2: Pin the default coding model — resolve it from the TARGET ENV, not a constant

> **Critical correction (investigated 2026-06-24).** The default `vibes-diy generate` uses is **NOT** `DEFAULT_CODING_MODEL` from `prompts/pkg/prompts.ts` (that constant, `anthropic/claude-opus-4.5`, is a different code path and nothing in-repo sets its env var). The deployed **API** resolves an unspecified model server-side in `getModelDefaults` (`vibes.diy/api/svc/intern/get-model-defaults.ts`) with a 3-tier fallback **per capability**: (1) app-level setting → (2) the **handle's** user-level `modelDefaults` → (3) the catalog `preSelected` model in `vibes.diy/api/svc/models.json`. For codegen (`app` mode) that floor is `preSelected:["app"]` = **`anthropic/claude-opus-4.6-fast`** (`chat` mode floor = `anthropic/claude-sonnet-4.6`). The catalog is fetched **per environment** (`loadModels` → `pkgRepos.workspace/@vibes.diy/api-svc/models.json`, `list-models.ts:35`), and the per-handle/per-app overrides live in **each env's DB** — so the resolved id can differ across dev/prod/cli/preview and depends on the `eval` handle's settings in the target env.

The issue requires recording the *resolved* default per iteration and pinning it so the only varying input is the prompt edit. Therefore **resolve the pin empirically from the target env + handle at kickoff** (do not hardcode), record it in `run.json`, and pass it as `--model` so every iteration is byte-identical on the model axis. A later default-model bump (catalog or `eval`-user override change) must explicitly invalidate `baseline.json` (Task 13), never silently move it.

**Files:**
- Create: `eval/access-model/src/model.ts`
- Test: `eval/access-model/src/model.test.ts`

- [ ] **Step 1: Write the failing test** (the pure picker over a fetched models catalog; the network fetch is injected)

```ts
import { describe, it, expect } from "vitest";
import { pickPreSelected, resolveDefaultModel } from "./model.js";

const catalog = [
  { id: "anthropic/claude-opus-4.6-fast", preSelected: ["app"] },
  { id: "anthropic/claude-sonnet-4.6", preSelected: ["chat"] },
  { id: "prodia/flux", preSelected: ["img"] },
];

describe("pickPreSelected", () => {
  it("picks the catalog model flagged for the app (codegen) capability", () => {
    expect(pickPreSelected(catalog, "app")).toBe("anthropic/claude-opus-4.6-fast");
  });
  it("throws if no model declares the capability", () => {
    expect(() => pickPreSelected([{ id: "x", preSelected: ["chat"] }], "app")).toThrow(/app/);
  });
});

describe("resolveDefaultModel", () => {
  it("uses an explicit matrix.model pin verbatim when set (no fetch)", async () => {
    const r = await resolveDefaultModel({ apiUrl: "https://x/api", handle: "eval", model: "anthropic/claude-opus-4.7" } as any, { fetchDefault: async () => "SHOULD_NOT_BE_CALLED" });
    expect(r).toBe("anthropic/claude-opus-4.7");
  });
  it("falls back to the env's resolved default for the handle when matrix.model is empty", async () => {
    const r = await resolveDefaultModel({ apiUrl: "https://x/api", handle: "eval", model: "" } as any, { fetchDefault: async () => "anthropic/claude-opus-4.6-fast" });
    expect(r).toBe("anthropic/claude-opus-4.6-fast");
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`./model.js` missing).

Run: `cd eval/access-model && pnpm exec vitest --run src/model.test.ts`

- [ ] **Step 3: Implement `src/model.ts`**

```ts
import type { AccessMatrix } from "./config.js";

export type Capability = "app" | "chat" | "img" | "img-edit";
export interface CatalogModel { readonly id: string; readonly preSelected?: readonly string[] }

/** The catalog floor for a capability — what getModelDefaults tier-3 resolves to. */
export function pickPreSelected(models: readonly CatalogModel[], cap: Capability): string {
  const found = models.find((m) => m.preSelected?.includes(cap));
  if (!found) throw new Error(`no preSelected model for capability: ${cap}`);
  return found.id;
}

export interface ResolveDeps {
  // Resolves what the TARGET env + handle actually defaults codegen to.
  // Real impl: query the models/defaults endpoint for `handle` (which applies the
  // user/app overrides), else fetch `${apiBase}/.../models.json` and pickPreSelected(_, "app").
  readonly fetchDefault: (matrix: AccessMatrix) => Promise<string>;
}

/**
 * Pin precedence: an explicit non-empty matrix.model wins verbatim (lets us pin a
 * specific id and freeze it); otherwise resolve the env's live default for the handle.
 * The resolved id is recorded in run.json so a later bump is visible and must
 * explicitly invalidate baseline.json.
 */
export async function resolveDefaultModel(matrix: AccessMatrix, deps: ResolveDeps): Promise<string> {
  if (matrix.model && matrix.model.trim()) return matrix.model.trim();
  return deps.fetchDefault(matrix);
}
```

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Write the real `fetchDefault`** — a thin client that asks the target env what the `eval` handle defaults to. Prefer the platform's models/defaults resolution (so per-handle/per-app overrides are honored exactly as a real generate would see them); if no such endpoint is reachable from the CLI host, fall back to fetching the env's `models.json` (derive the asset URL from `apiUrl` per the stable-entry routing in `agents/environments.md`) and `pickPreSelected(models, "app")`. Log the resolved id loudly at kickoff. Keep the unit test on the injected fake.

- [ ] **Step 6: Commit**

```bash
git add eval/access-model/src/model.ts eval/access-model/src/model.test.ts
git commit -m "eval(access-model): resolve+pin the target env's default codegen model"
```

---

## Task 3: Static access-model grader (`invariants.ts`)

This is the heart: greppable, **static-first** invariants over `access.js` (and a couple over `App.jsx`). Each invariant returns a boolean; `grade.ts` (Task 5) combines them per dimension. Encodes the design-doc grammar: Form-A strict/broad, `isOwner` write-gate, the per-object recipe, owner-published, author-owned. Detection is regex over source text (the access fns are sync and small; see results JSON `method`).

**Files:**
- Create: `eval/access-model/src/invariants.ts`
- Test: `eval/access-model/src/invariants.test.ts`

- [ ] **Step 1: Write the failing tests** (representative fixtures drawn from the #2588 corpus shapes)

```ts
import { describe, it, expect } from "vitest";
import { analyzeAccess } from "./invariants.js";

const habitFormA = `export default function access(doc, oldDoc, user) {
  if (doc.type === "habit") return ctx.requireRole("owner");
  return { channels: ["habits"] };
}`;

const todoPerVisitor = `export default function access(doc, oldDoc, user) {
  if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: true };
  if (doc.authorHandle !== user.userHandle) throw { forbidden: true };
  return { channels: [\`user:\${user.userHandle}\`], grant: { users: { [user.userHandle]: [\`user:\${user.userHandle}\`] } } };
}`;

const blogOwner = `export default function access(doc, oldDoc, user) {
  ctx.requireRole("owner");
  return { channels: ["posts"], grant: { public: ["posts"] } };
}`;

const shopPerObject = `export default function access(doc, oldDoc, user) {
  if (doc.type === "list") {
    return { channels: [\`list:\${doc._id}\`], members: { [\`list:\${doc._id}\`]: [user.userHandle] },
      grant: { users: { [user.userHandle]: [\`list:\${doc._id}\`] } } };
  }
  if (doc.type === "share") { ctx.requireAccess(\`list:\${doc.listId}\`); return { channels: [\`list:\${doc.listId}\`], grant: { users: { [doc.invitee]: [\`list:\${doc.listId}\`] } } }; }
  ctx.requireAccess(\`list:\${doc.listId}\`);
  if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) throw { forbidden: true };
  return { channels: [\`list:\${doc.listId}\`] };
}`;

describe("analyzeAccess", () => {
  it("flags Form-A strict when a non-owner-published core write is gated on requireRole('owner')", () => {
    const a = analyzeAccess(habitFormA, "per-visitor");
    expect(a.formAStrict).toBe(true);
    expect(a.isOwnerWriteGate).toBe(false);
  });
  it("recognizes a clean per-visitor model (author check both create+update, self-grant, no owner gate)", () => {
    const a = analyzeAccess(todoPerVisitor, "per-visitor");
    expect(a.formAStrict).toBe(false);
    expect(a.perVisitorClean).toBe(true);
    expect(a.authorImmutable).toBe(true);
  });
  it("accepts owner-published requireRole('owner') write + public read (not Form-A for this dimension)", () => {
    const a = analyzeAccess(blogOwner, "owner-published");
    expect(a.formAStrict).toBe(false);
    expect(a.ownerPublished).toBe(true);
    expect(a.publicRead).toBe(true);
  });
  it("detects the per-object recipe: object channel + self-grant + member-authored share + requireAccess child + author-immutable", () => {
    const a = analyzeAccess(shopPerObject, "per-object");
    expect(a.objectChannel).toBe(true);
    expect(a.selfGrant).toBe(true);
    expect(a.memberAuthoredShare).toBe(true);
    expect(a.requireAccessChild).toBe(true);
    expect(a.authorImmutable).toBe(true);
    expect(a.perObjectRecipe).toBe(true);
  });
  it("flags an isOwner write-gate anywhere in access.js", () => {
    const a = analyzeAccess(`export default function access(doc, oldDoc, user){ if(!user.isOwner) throw {forbidden:true}; return {channels:["x"]}; }`, "per-visitor");
    expect(a.isOwnerWriteGate).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests → FAIL** (`./invariants.js` missing).

Run: `cd eval/access-model && pnpm exec vitest --run src/invariants.test.ts`

- [ ] **Step 3: Implement `src/invariants.ts`**

```ts
import type { Dimension } from "./config.js";

export interface AccessAnalysis {
  // hard signals
  readonly isOwnerWriteGate: boolean;   // any user.isOwner gating a write -> design forbids (target 0)
  readonly requireRoleOwnerWrite: boolean; // a core write gated on requireRole("owner")
  // Form-A
  readonly formAStrict: boolean;        // requireRole("owner") core write where the dimension should be multiplayer
  readonly formABroad: boolean;         // owner-only membership with no join/request path (per-object dims)
  // per-visitor
  readonly perUserChannel: boolean;     // channel keyed on user handle
  readonly authorCheckCreate: boolean;
  readonly authorCheckUpdate: boolean;  // oldDoc author compared
  readonly authorImmutable: boolean;    // oldDoc author cannot change
  readonly selfGrant: boolean;          // grant.users[...] self-grant present
  readonly perVisitorClean: boolean;
  // per-object recipe
  readonly objectChannel: boolean;      // channel like `name:${...}` keyed on an object id
  readonly memberAuthoredShare: boolean;// a `share`/invite branch that grants another user in
  readonly requireAccessChild: boolean; // child docs gated by ctx.requireAccess(objectChannel)
  readonly joinPath: boolean;           // a request/join branch (membership reachable by non-owner)
  readonly perObjectRecipe: boolean;
  // owner-published / author-owned
  readonly ownerPublished: boolean;     // requireRole("owner") write + public read
  readonly publicRead: boolean;         // grant.public read
  readonly authorOwned: boolean;        // any signed-in author writes own doc, public read
}

const RE = {
  isOwner: /\buser\.isOwner\b/,
  requireRoleOwner: /requireRole\(\s*["'`]owner["'`]\s*\)/,
  perUserChannel: /user:\$\{[^}]*\b(userHandle|authorHandle|handle)\b[^}]*\}/,
  objectChannel: /[`"']\w+:\$\{[^}]*\b(_id|Id|id)\b[^}]*\}/, // e.g. `list:${doc._id}`
  grantUsers: /grant\s*:\s*\{[^}]*\busers\b/s,
  grantPublic: /grant\s*:\s*\{[^}]*\bpublic\b/s,
  requireAccess: /requireAccess\(/,
  oldDocAuthor: /oldDoc\b[^]*?\.(authorHandle|author|userHandle|owner)\b/,
  authorCreate: /\b(doc\.(authorHandle|author|userHandle))\b[^]*?(!==|===)\s*user\.(userHandle|handle)/,
  shareBranch: /\b(type\s*===\s*["'`](share|invite|member|join)["'`]|doc\.(invitee|inviteHandle|memberHandle))\b/,
  joinBranch: /\b(type\s*===\s*["'`](join|request)["'`]|requestToJoin|joinRequest)\b/,
};

export function analyzeAccess(src: string, expect: Dimension): AccessAnalysis {
  const has = (re: RegExp) => re.test(src);
  const isOwnerWriteGate = has(RE.isOwner);
  const requireRoleOwnerWrite = has(RE.requireRoleOwner);
  const perUserChannel = has(RE.perUserChannel);
  const selfGrant = has(RE.grantUsers);
  const publicRead = has(RE.grantPublic);
  const requireAccessChild = has(RE.requireAccess);
  const authorCheckCreate = has(RE.authorCreate);
  const authorCheckUpdate = has(RE.oldDocAuthor);
  const authorImmutable = authorCheckUpdate; // oldDoc author compared => immutable
  const objectChannel = has(RE.objectChannel);
  const memberAuthoredShare = has(RE.shareBranch) && selfGrant;
  const joinPath = has(RE.joinBranch) || memberAuthoredShare;

  // owner-published is the ONLY dimension where requireRole("owner") on the write is correct.
  const ownerPublished = requireRoleOwnerWrite && publicRead;
  // Form-A strict: an owner-gated core write in a dimension that must be multiplayer/per-visitor.
  const multiplayer = expect === "per-visitor" || expect === "per-object" || expect === "author-owned";
  const formAStrict = multiplayer && requireRoleOwnerWrite;
  // Form-A broad (per-object): membership exists but only the owner can grant it (no join path).
  const formABroad = expect === "per-object" && objectChannel && !joinPath;

  const perVisitorClean =
    expect === "per-visitor" && perUserChannel && authorCheckCreate && authorImmutable && selfGrant && !requireRoleOwnerWrite && !isOwnerWriteGate;
  const perObjectRecipe =
    expect === "per-object" && objectChannel && selfGrant && memberAuthoredShare && requireAccessChild && authorImmutable;
  const authorOwned =
    (expect === "author-owned") && authorCheckCreate && publicRead && !requireRoleOwnerWrite && !isOwnerWriteGate;

  return {
    isOwnerWriteGate, requireRoleOwnerWrite, formAStrict, formABroad,
    perUserChannel, authorCheckCreate, authorCheckUpdate, authorImmutable, selfGrant, perVisitorClean,
    objectChannel, memberAuthoredShare, requireAccessChild, joinPath, perObjectRecipe,
    ownerPublished, publicRead, authorOwned,
  };
}
```

- [ ] **Step 4: Run tests → PASS.** Iterate the regexes against the fixtures until green. (If a real corpus file from `vibes/eval/access-model-2588/` disagrees, add it as a fixture and adjust — the corpus is the ground truth.)

- [ ] **Step 5: Add corpus regression fixtures** — read the 8 `access.js` files under `vibes/eval/access-model-2588/row*/` and assert `analyzeAccess` reproduces the documented grades' key signals (row2 `formAStrict===true`, row5 `ownerPublished===true`, row1 `perVisitorClean===true` for the model axis, etc.). One `it()` per row.

- [ ] **Step 6: Run → PASS, then Commit**

```bash
git add eval/access-model/src/invariants.ts eval/access-model/src/invariants.test.ts
git commit -m "eval(access-model): static access-model invariant grader"
```

---

## Task 4: Renderability + two-file checks (`renderable.ts`)

Encodes verify gates 2 (two-file emission) and 3 (renderable) at the per-cell level. Catches the `9cf43ea`-class regression (access-fn code under the `App.jsx` filename) and the row-1 duplicate-import non-render.

**Files:**
- Create: `eval/access-model/src/renderable.ts`
- Test: `eval/access-model/src/renderable.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { checkFiles } from "./renderable.js";

describe("checkFiles", () => {
  it("twoFile=false when access.js is missing or trivial", () => {
    expect(checkFiles({ "App.jsx": "export default function App(){return null}" }).twoFile).toBe(false);
  });
  it("twoFile=true when both present and non-trivial", () => {
    const r = checkFiles({ "App.jsx": "export default function App(){return <div/>}", "access.js": "export default function access(d,o,u){return {channels:['x']}}" });
    expect(r.twoFile).toBe(true);
  });
  it("renderable=false on duplicate import (ESM redeclaration)", () => {
    const app = `import { useFireproof } from "use-fireproof";\nimport { useFireproof } from "use-fireproof";\nexport default function App(){return <div/>}`;
    expect(checkFiles({ "App.jsx": app, "access.js": "export default function access(){}" }).renderable).toBe(false);
  });
  it("renderable=false when App.jsx actually contains the access fn (filename clobber)", () => {
    const app = `export default function access(doc, oldDoc, user){ return {channels:['x']} }`;
    expect(checkFiles({ "App.jsx": app, "access.js": "x" }).renderable).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/renderable.test.ts`

- [ ] **Step 3: Implement `src/renderable.ts`**

```ts
export interface FileCheck {
  readonly twoFile: boolean;     // both access.js and App.jsx present and non-trivial
  readonly renderable: boolean;  // App.jsx parses-ish, no dup import, not an access-fn clobber
  readonly reasons: string[];
}

const NONTRIVIAL = 40; // chars

function dupImport(src: string): boolean {
  const names = new Map<string, number>();
  for (const m of src.matchAll(/import\s+\{([^}]*)\}\s+from/g)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      names.set(name, (names.get(name) ?? 0) + 1);
    }
  }
  return [...names.values()].some((n) => n > 1);
}

export function checkFiles(files: Record<string, string>): FileCheck {
  const reasons: string[] = [];
  const app = files["App.jsx"] ?? "";
  const access = files["access.js"] ?? "";
  const twoFile = app.trim().length >= NONTRIVIAL && access.trim().length >= NONTRIVIAL;
  if (!twoFile) reasons.push("missing or trivial access.js/App.jsx");

  const isAccessClobber = /export\s+default\s+function\s+access\s*\(/.test(app) && !/function\s+App\s*\(/.test(app);
  if (isAccessClobber) reasons.push("App.jsx contains the access function (filename clobber)");
  const hasDup = dupImport(app);
  if (hasDup) reasons.push("duplicate import (ESM redeclaration)");
  const hasApp = /export\s+default\s+function\s+App\s*\(|export\s+default\s+App\b/.test(app);
  if (!hasApp) reasons.push("no default App export");

  const renderable = hasApp && !isAccessClobber && !hasDup;
  return { twoFile, renderable, reasons };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/renderable.ts eval/access-model/src/renderable.test.ts
git commit -m "eval(access-model): two-file + renderability checks"
```

---

## Task 5: Grade composition (`grade.ts`)

Turns the static analysis + the optional judge verdict + the file checks into a per-row grade ∈ {PASS, SOFT, FAIL}, mirroring the two grading axes from the results JSON (model correctness AND App renderability).

**Files:**
- Create: `eval/access-model/src/grade.ts`
- Test: `eval/access-model/src/grade.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { gradeRow } from "./grade.js";
import type { AccessAnalysis } from "./invariants.js";

const clean = (o: Partial<AccessAnalysis>): AccessAnalysis => ({
  isOwnerWriteGate: false, requireRoleOwnerWrite: false, formAStrict: false, formABroad: false,
  perUserChannel: false, authorCheckCreate: false, authorCheckUpdate: false, authorImmutable: false,
  selfGrant: false, perVisitorClean: false, objectChannel: false, memberAuthoredShare: false,
  requireAccessChild: false, joinPath: false, perObjectRecipe: false, ownerPublished: false,
  publicRead: false, authorOwned: false, ...o,
});

describe("gradeRow", () => {
  it("FAIL on Form-A strict regardless of render", () => {
    const g = gradeRow({ expect: "per-visitor", analysis: clean({ formAStrict: true }),
      files: { twoFile: true, renderable: true, reasons: [] }, judge: null });
    expect(g.grade).toBe("FAIL");
  });
  it("FAIL on isOwner write-gate", () => {
    const g = gradeRow({ expect: "per-visitor", analysis: clean({ perVisitorClean: true, isOwnerWriteGate: true }),
      files: { twoFile: true, renderable: true, reasons: [] }, judge: null });
    expect(g.grade).toBe("FAIL");
  });
  it("SOFT when model correct but App not renderable (orthogonal completeness failure)", () => {
    const g = gradeRow({ expect: "per-visitor", analysis: clean({ perVisitorClean: true }),
      files: { twoFile: true, renderable: false, reasons: ["duplicate import"] }, judge: { secondVisitorCanAct: true, reason: "" } });
    expect(g.grade).toBe("SOFT");
  });
  it("PASS when model correct, renderable, and the second visitor can act", () => {
    const g = gradeRow({ expect: "per-visitor", analysis: clean({ perVisitorClean: true }),
      files: { twoFile: true, renderable: true, reasons: [] }, judge: { secondVisitorCanAct: true, reason: "" } });
    expect(g.grade).toBe("PASS");
  });
  it("FAIL when the judge says a second visitor is locked out of a multiplayer app", () => {
    const g = gradeRow({ expect: "per-object", analysis: clean({ perObjectRecipe: true }),
      files: { twoFile: true, renderable: true, reasons: [] }, judge: { secondVisitorCanAct: false, reason: "owner-only" } });
    expect(g.grade).toBe("FAIL");
  });
  it("per-object without the full recipe is FAIL on the model axis", () => {
    const g = gradeRow({ expect: "per-object", analysis: clean({ objectChannel: true }),
      files: { twoFile: true, renderable: true, reasons: [] }, judge: { secondVisitorCanAct: true, reason: "" } });
    expect(g.grade).toBe("FAIL");
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/grade.test.ts`

- [ ] **Step 3: Implement `src/grade.ts`**

```ts
import type { AccessAnalysis } from "./invariants.js";
import type { Dimension } from "./config.js";
import type { FileCheck } from "./renderable.js";

export type Grade = "PASS" | "SOFT" | "FAIL";
export interface JudgeVerdict { readonly secondVisitorCanAct: boolean; readonly reason: string; }

export interface RowGradeInput {
  readonly expect: Dimension;
  readonly analysis: AccessAnalysis;
  readonly files: FileCheck;
  readonly judge: JudgeVerdict | null; // null when judge not run (static-decisive) or unavailable
}
export interface RowGrade { readonly grade: Grade; readonly modelOk: boolean; readonly reasons: string[]; }

// Is the access MODEL correct for the expected dimension? (axis a)
function modelCorrect(expect: Dimension, a: AccessAnalysis): { ok: boolean; reason: string } {
  if (a.isOwnerWriteGate) return { ok: false, reason: "isOwner write-gate (design forbids)" };
  switch (expect) {
    case "per-visitor":
      if (a.formAStrict) return { ok: false, reason: "Form-A: requireRole('owner') core write" };
      return a.perVisitorClean ? { ok: true, reason: "per-visitor clean" } : { ok: false, reason: "incomplete per-visitor model" };
    case "per-object":
      if (a.formAStrict) return { ok: false, reason: "Form-A on a collaboration app" };
      if (a.formABroad) return { ok: false, reason: "owner-only membership, no join path" };
      return a.perObjectRecipe ? { ok: true, reason: "per-object recipe reached" } : { ok: false, reason: "incomplete per-object recipe" };
    case "owner-published":
      return a.ownerPublished && !a.isOwnerWriteGate ? { ok: true, reason: "owner-published" } : { ok: false, reason: "not owner-published (need requireRole('owner') write + public read)" };
    case "author-owned":
      if (a.formAStrict) return { ok: false, reason: "Form-A on an author-owned app" };
      return a.authorOwned ? { ok: true, reason: "author-owned + public read" } : { ok: false, reason: "incomplete author-owned model" };
    case "multi-tier":
      // lenient: must merely WORK; judge decides reachability. Static only rejects hard footguns.
      return { ok: true, reason: "multi-tier (judge-decided)" };
  }
}

export function gradeRow(input: RowGradeInput): RowGrade {
  const reasons: string[] = [];
  const mc = modelCorrect(input.expect, input.analysis);
  reasons.push(mc.reason);

  // Judge can veto a model that looks fine statically but locks out a second visitor.
  const multiplayer = input.expect === "per-visitor" || input.expect === "per-object" || input.expect === "author-owned" || input.expect === "multi-tier";
  const judgeVeto = multiplayer && input.judge !== null && !input.judge.secondVisitorCanAct;
  if (judgeVeto) reasons.push(`judge: second visitor locked out — ${input.judge!.reason}`);

  const modelOk = mc.ok && !judgeVeto;
  if (!modelOk) return { grade: "FAIL", modelOk, reasons };

  // Model is correct. Axis b: renderability / completeness.
  if (!input.files.twoFile || !input.files.renderable) {
    reasons.push(...input.files.reasons);
    return { grade: "SOFT", modelOk, reasons }; // correct model, app won't render -> SOFT, not PASS
  }
  return { grade: "PASS", modelOk, reasons };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/grade.ts eval/access-model/src/grade.test.ts
git commit -m "eval(access-model): PASS/SOFT/FAIL grade composition"
```

---

## Task 6: Composite metric (`metric.ts`)

The maximize target: `mean(PASS=1 / SOFT=0.5 / FAIL=0)` over the matrix × reps, plus the roll-up signals the results JSON reports (Form-A strict/broad rate, isOwner count, two-file rate, renderable rate).

**Files:**
- Create: `eval/access-model/src/metric.ts`
- Test: `eval/access-model/src/metric.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { compositeMetric, rollup } from "./metric.js";

const cells = [
  { grade: "PASS", twoFile: true, renderable: true, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: true },
  { grade: "SOFT", twoFile: true, renderable: false, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: true },
  { grade: "FAIL", twoFile: true, renderable: true, formAStrict: true, formABroad: false, isOwnerWriteGate: false, ok: true },
  { grade: "GENERATE_FAILED", twoFile: false, renderable: false, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: false },
] as const;

describe("compositeMetric", () => {
  it("averages PASS=1/SOFT=.5/FAIL=0 over scored cells only (platform failures excluded)", () => {
    // (1 + 0.5 + 0) / 3 = 0.5
    expect(compositeMetric(cells as any)).toBeCloseTo(0.5, 5);
  });
});

describe("rollup", () => {
  it("computes form-A and two-file rates over scored cells", () => {
    const r = rollup(cells as any);
    expect(r.scored).toBe(3);
    expect(r.platformFailed).toBe(1);
    expect(r.formAStrictRate).toBeCloseTo(1 / 3, 5);
    expect(r.twoFileRate).toBeCloseTo(1, 5); // 3/3 scored cells emitted two files
    expect(r.renderableRate).toBeCloseTo(2 / 3, 5);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/metric.test.ts`

- [ ] **Step 3: Implement `src/metric.ts`**

```ts
import type { Grade } from "./grade.js";

export interface MetricCell {
  readonly grade: Grade | "GENERATE_FAILED";
  readonly twoFile: boolean;
  readonly renderable: boolean;
  readonly formAStrict: boolean;
  readonly formABroad: boolean;
  readonly isOwnerWriteGate: boolean;
  readonly ok: boolean; // false => platform/generate failure, excluded from score
}

const VALUE: Record<Grade, number> = { PASS: 1, SOFT: 0.5, FAIL: 0 };
const scoredOnly = (cells: readonly MetricCell[]) => cells.filter((c) => c.ok && c.grade !== "GENERATE_FAILED");

export function compositeMetric(cells: readonly MetricCell[]): number {
  const scored = scoredOnly(cells);
  if (scored.length === 0) return 0;
  return scored.reduce((s, c) => s + VALUE[c.grade as Grade], 0) / scored.length;
}

export interface Rollup {
  readonly scored: number;
  readonly platformFailed: number;
  readonly metric: number;
  readonly formAStrictRate: number;
  readonly formABroadRate: number;
  readonly isOwnerCount: number;
  readonly twoFileRate: number;
  readonly renderableRate: number;
}

export function rollup(cells: readonly MetricCell[]): Rollup {
  const scored = scoredOnly(cells);
  const n = scored.length || 1;
  const rate = (p: (c: MetricCell) => boolean) => scored.filter(p).length / n;
  return {
    scored: scored.length,
    platformFailed: cells.length - scored.length,
    metric: compositeMetric(cells),
    formAStrictRate: rate((c) => c.formAStrict),
    formABroadRate: rate((c) => c.formABroad),
    isOwnerCount: scored.filter((c) => c.isOwnerWriteGate).length,
    twoFileRate: rate((c) => c.twoFile),
    renderableRate: rate((c) => c.renderable),
  };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/metric.ts eval/access-model/src/metric.test.ts
git commit -m "eval(access-model): composite metric + rollup signals"
```

---

## Task 7: Second-visitor LLM judge (`judge.ts`)

The single semantic call the issue allows: *"can a second signed-in visitor do the core action?"* Reuses codegen-matrix's judge transport (`call-ai`, `LLM_BACKEND_URL/API_KEY` via `resolveDevVars`) and the retry/backoff. Only invoked when static analysis is non-decisive or the dimension is multiplayer (per-visitor/per-object/author-owned/multi-tier).

**Files:**
- Create: `eval/access-model/src/judge.ts`
- Test: `eval/access-model/src/judge.test.ts`

- [ ] **Step 1: Write the failing test** (inject a fake caller so no network in unit tests)

```ts
import { describe, it, expect } from "vitest";
import { judgeSecondVisitor } from "./judge.js";

describe("judgeSecondVisitor", () => {
  it("returns the structured verdict from the model", async () => {
    const fakeCall = async () => ({ secondVisitorCanAct: true, reason: "second handle adds its own todos" });
    const v = await judgeSecondVisitor({ prompt: "A todo list app", expect: "per-visitor",
      files: { "App.jsx": "x", "access.js": "y" } }, { call: fakeCall, model: "m", endpoint: "e", apiKey: "k" });
    expect(v).toEqual({ secondVisitorCanAct: true, reason: "second handle adds its own todos" });
  });
  it("degrades to null on judge failure", async () => {
    const boom = async () => { throw new Error("429"); };
    const v = await judgeSecondVisitor({ prompt: "p", expect: "per-object", files: { "App.jsx": "x", "access.js": "y" } },
      { call: boom, model: "m", endpoint: "e", apiKey: "k", maxAttempts: 1 });
    expect(v).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/judge.test.ts`

- [ ] **Step 3: Implement `src/judge.ts`** (transport injected; real entry resolves `call-ai` + dev-vars like codegen-matrix `judge.ts`)

```ts
import type { Dimension } from "./config.js";
import type { JudgeVerdict } from "./grade.js";

export interface JudgeDeps {
  readonly call: (args: { model: string; endpoint: string; apiKey: string; prompt: string; schema: object }) => Promise<JudgeVerdict>;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly maxAttempts?: number;
}

const SCHEMA = {
  type: "object",
  properties: { secondVisitorCanAct: { type: "boolean" }, reason: { type: "string" } },
  required: ["secondVisitorCanAct", "reason"],
} as const;

export function buildJudgePrompt(o: { prompt: string; expect: Dimension; files: Record<string, string> }): string {
  return [
    `A code generator produced a multi-user app from the request: "${o.prompt}".`,
    `Expected access shape: ${o.expect}.`,
    `Judge ONE thing: after the creator uses it, can a DIFFERENT signed-in visitor perform the app's core action`,
    `(add an item / join / post / collaborate), each within the model's intended scope?`,
    `For per-visitor apps the second visitor must be able to keep THEIR OWN data (not edit the creator's).`,
    `For per-object/author-owned apps a second visitor must be able to participate (join/contribute).`,
    `Answer false ONLY if the second visitor is locked out of the core action by the access model.`,
    `\n--- access.js ---\n${o.files["access.js"] ?? "(missing)"}`,
    `\n--- App.jsx ---\n${o.files["App.jsx"] ?? "(missing)"}`,
  ].join("\n");
}

export async function judgeSecondVisitor(
  input: { prompt: string; expect: Dimension; files: Record<string, string> },
  deps: JudgeDeps,
): Promise<JudgeVerdict | null> {
  const max = deps.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await deps.call({ model: deps.model, endpoint: deps.endpoint, apiKey: deps.apiKey, prompt: buildJudgePrompt(input), schema: SCHEMA });
    } catch (e) { lastErr = e; }
  }
  void lastErr;
  return null;
}
```

- [ ] **Step 4: Run → PASS.** Then write the real `call` adapter (a thin wrapper over `call-ai` mirroring `eval/codegen-matrix/src/judge.ts` — same endpoint/apiKey/schema call shape) and export a `realJudgeDeps(matrix)` factory that resolves dev-vars via codegen-matrix's `resolveDevVars`. Unit test stays on the injected fake.

- [ ] **Step 5: Commit**

```bash
git add eval/access-model/src/judge.ts eval/access-model/src/judge.test.ts
git commit -m "eval(access-model): second-visitor judge (single semantic call)"
```

---

## Task 8: Generate driver (`generate.ts`)

Drives `vibes-diy generate` across `eval × reps` (and `holdout × reps`) on the **pinned default model**, reusing codegen-matrix's pool/retry/cell helpers. The one behavioral difference from codegen-matrix: pass `--model <resolvedDefault>` (the pinned default), record it in `run.json`, and pull both `access.js` and `App.jsx` from the generated app dir.

**Files:**
- Create: `eval/access-model/src/generate.ts`
- Test: `eval/access-model/src/generate.test.ts` (pure-arg builder only; live path validated by smoke run in Task 15)

- [ ] **Step 1: Write the failing test** (the pure arg builder; mirrors codegen-matrix's `buildGenerateArgs` test)

```ts
import { describe, it, expect } from "vitest";
import { buildAccessGenerateArgs } from "./generate.js";

describe("buildAccessGenerateArgs", () => {
  it("pins the resolved default model and passes handle/apiUrl/prompt", () => {
    expect(buildAccessGenerateArgs({ model: "anthropic/claude-opus-4.5", handle: "eval", apiUrl: "https://x/api", prompt: "A todo list app" }))
      .toEqual(["generate", "--model", "anthropic/claude-opus-4.5", "--handle", "eval", "--api-url", "https://x/api", "A todo list app"]);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/generate.test.ts`

- [ ] **Step 3: Implement `src/generate.ts`**

The arg builder is trivially testable; the orchestration reuses codegen-matrix.

```ts
import { mapWithConcurrency } from "../../codegen-matrix/src/pool.js";
import { runWithRetries } from "../../codegen-matrix/src/generate.js";
import { discoverAppSlug } from "../../codegen-matrix/src/cell.js";
import { resolveDefaultModel } from "./model.js";
// NOTE: match codegen-matrix's intra-package import extension convention.

export function buildAccessGenerateArgs(o: { model: string; handle: string; apiUrl: string; prompt: string }): string[] {
  return ["generate", "--model", o.model, "--handle", o.handle, "--api-url", o.apiUrl, o.prompt];
}
```

- The `main()` entrypoint (run via `pnpm run generate`):
  1. Parse `--matrix`, `--prompts` (default `config/prompts.eval.jsonl`; `--holdout` switches to `config/prompts.holdout.jsonl`), `--concurrency`, `--run` flags (mirror codegen-matrix flag parsing).
  2. `const model = matrix.model || resolveDefaultModel();` — pin once; write `model` + `cliVersion` + `commitSha` into `run.json` (extend codegen-matrix's `RunJson` shape with `model`, `promptsFile`).
  3. Build the cell list `prompts × reps`; for each cell run `runWithRetries(() => execGenerate(buildAccessGenerateArgs({model, handle, apiUrl, prompt})))` (copy `execGenerate`/`summarizeReason` usage from codegen-matrix `generate.ts`; or import `summarizeReason`).
  4. On success, `discoverAppSlug` the app dir; read `access.js` + `App.jsx` into the cell record; write `cell.json` (reuse `writeCellJson`/`cellDirName`). On 3 failures mark `exitState: "generate-failed"` (excluded from score per the issue).
  5. **Concurrency step-down:** start at `matrix.concurrency` (32); the issue's step-down to 16→8 is a manual re-run lever (`--concurrency 16`), recorded in `run.json`.

- [ ] **Step 4: Run the arg test → PASS.** (Live generation is exercised in Task 15.) **Commit**

```bash
git add eval/access-model/src/generate.ts eval/access-model/src/generate.test.ts
git commit -m "eval(access-model): generate driver (pinned default model, pulls access.js+App.jsx)"
```

---

## Task 9: Score stage (`score.ts`)

Reads a run's cells, runs `analyzeAccess` + `checkFiles` (static, always), invokes `judgeSecondVisitor` (only for multiplayer dims or static-ambiguous cells), composes `gradeRow`, and writes `cell.score.json` per cell.

**Files:**
- Create: `eval/access-model/src/score.ts`
- Test: `eval/access-model/src/score.test.ts` (the per-cell scoring function, judge injected)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { scoreCell } from "./score.js";

describe("scoreCell", () => {
  it("grades a clean per-visitor cell PASS using static + judge", async () => {
    const files = {
      "App.jsx": "export default function App(){ return <div>hi there friend</div> }",
      "access.js": "export default function access(doc,oldDoc,user){ if(oldDoc && oldDoc.authorHandle!==user.userHandle) throw {forbidden:true}; if(doc.authorHandle!==user.userHandle) throw {forbidden:true}; return {channels:[`user:${user.userHandle}`], grant:{users:{[user.userHandle]:[`user:${user.userHandle}`]}}} }",
    };
    const judge = async () => ({ secondVisitorCanAct: true, reason: "ok" });
    const r = await scoreCell({ expect: "per-visitor", prompt: "A todo list app", files }, { judge });
    expect(r.grade).toBe("PASS");
    expect(r.formAStrict).toBe(false);
    expect(r.twoFile).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/score.test.ts`

- [ ] **Step 3: Implement `scoreCell`** (pure-ish; judge injected) and the `main()` stage that maps it over a run with `mapWithConcurrency(scoreConcurrency)`, writing `cell.score.json`.

```ts
import { analyzeAccess } from "./invariants.js";
import { checkFiles } from "./renderable.js";
import { gradeRow, type JudgeVerdict } from "./grade.js";
import type { Dimension } from "./config.js";

export interface ScoredCell {
  grade: ReturnType<typeof gradeRow>["grade"];
  modelOk: boolean;
  twoFile: boolean;
  renderable: boolean;
  formAStrict: boolean;
  formABroad: boolean;
  isOwnerWriteGate: boolean;
  reasons: string[];
}

export async function scoreCell(
  input: { expect: Dimension; prompt: string; files: Record<string, string> },
  deps: { judge: (a: { prompt: string; expect: Dimension; files: Record<string, string> }) => Promise<JudgeVerdict | null> },
): Promise<ScoredCell> {
  const analysis = analyzeAccess(input.files["access.js"] ?? "", input.expect);
  const files = checkFiles(input.files);
  const multiplayer = ["per-visitor", "per-object", "author-owned", "multi-tier"].includes(input.expect);
  const judge = multiplayer ? await deps.judge({ prompt: input.prompt, expect: input.expect, files: input.files }) : null;
  const g = gradeRow({ expect: input.expect, analysis, files, judge });
  return {
    grade: g.grade, modelOk: g.modelOk, twoFile: files.twoFile, renderable: files.renderable,
    formAStrict: analysis.formAStrict, formABroad: analysis.formABroad, isOwnerWriteGate: analysis.isOwnerWriteGate,
    reasons: g.reasons,
  };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/score.ts eval/access-model/src/score.test.ts
git commit -m "eval(access-model): score stage (static + judge per cell)"
```

---

## Task 10: Report stage (`report.ts`)

Aggregates a scored run into (a) `results.json` matching the `eval-2588-access-model-results-*.json` schema (so it's diffable against the hand baseline), (b) `access-summary.md` (a human table), and (c) prints `METRIC=<x>` to stdout — the scalar the autoresearch loop reads.

**Files:**
- Create: `eval/access-model/src/report.ts`
- Test: `eval/access-model/src/report.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildResults, renderMetricLine } from "./report.js";

const scored = [
  { id: "todo", expect: "per-visitor", grade: "PASS", twoFile: true, renderable: true, formAStrict: false, formABroad: false, isOwnerWriteGate: false, ok: true, reps: [{}] },
  { id: "habit", expect: "per-visitor", grade: "FAIL", twoFile: true, renderable: true, formAStrict: true, formABroad: false, isOwnerWriteGate: false, ok: true, reps: [{}] },
] as any;

describe("buildResults", () => {
  it("emits rollup with metric + form-A rate and a row per prompt", () => {
    const r = buildResults(scored);
    expect(r.rollup.metric).toBeCloseTo(0.5, 5);
    expect(r.rollup.formAStrictRate).toBeCloseTo(0.5, 5);
    expect(r.rows.map((x: any) => x.id)).toEqual(["todo", "habit"]);
  });
});

describe("renderMetricLine", () => {
  it("prints a parseable METRIC= line", () => {
    expect(renderMetricLine(0.625)).toBe("METRIC=0.625");
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/report.test.ts`

- [ ] **Step 3: Implement `src/report.ts`** — `buildResults(cells)` produces `{ rollup: Rollup, rows: [...] }` (rollup via `metric.ts`), `renderMetricLine(m)` → `` `METRIC=${m}` ``, `renderSummary(results)` → markdown, and `main()` writes `results.json` + `access-summary.md` into the run dir and `console.log(renderMetricLine(results.rollup.metric))`.

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/report.ts eval/access-model/src/report.test.ts
git commit -m "eval(access-model): report (results.json + METRIC scalar)"
```

---

## Task 11: Design-doc guardrail (`guardrail.ts`)

Verify gate 4. Operates on the **prompt diff** (the iteration's change to `prompts/pkg/`): rejects edits that add enumerated "never/don't…" prohibitions to the access section, or that *name* the owner-only anti-pattern (the `489ff77` lesson — naming it taught the model to reach for it). Grep-first, with a small LLM judge for the semantic "does this enumerate a prohibition" call.

**Files:**
- Create: `eval/access-model/src/guardrail.ts`
- Test: `eval/access-model/src/guardrail.test.ts`

- [ ] **Step 1: Write the failing tests** (grep layer only; judge injected)

```ts
import { describe, it, expect } from "vitest";
import { guardrailGrep } from "./guardrail.js";

describe("guardrailGrep", () => {
  it("flags added enumerated prohibitions in access guidance", () => {
    const diff = `+ Never gate the core write on the owner role.\n+ Don't use requireRole(\"owner\") for todos.`;
    const r = guardrailGrep(diff);
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
  });
  it("flags naming the owner-only anti-pattern", () => {
    expect(guardrailGrep(`+ Avoid the Form-A trap (owner-only writes).`).ok).toBe(false);
  });
  it("passes affirmative shape->model guidance", () => {
    expect(guardrailGrep(`+ A todo app gives every visitor their own private channel: user:\${user.userHandle}.`).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/guardrail.test.ts`

- [ ] **Step 3: Implement `src/guardrail.ts`**

```ts
export interface GuardrailResult { readonly ok: boolean; readonly hits: string[]; }

const ADDED = /^\+(?!\+)/; // added line in a unified diff, not the +++ header
const PROHIBITION = /\b(never|don'?t|do not|avoid|must not|should not)\b/i;
const ANTIPATTERN_NAME = /\bForm-A\b|owner-only (writes?|app)|the owner trap/i;

export function guardrailGrep(diff: string): GuardrailResult {
  const hits: string[] = [];
  for (const line of diff.split("\n")) {
    if (!ADDED.test(line)) continue;
    const text = line.slice(1);
    if (PROHIBITION.test(text)) hits.push(`prohibition: ${text.trim()}`);
    if (ANTIPATTERN_NAME.test(text)) hits.push(`anti-pattern naming: ${text.trim()}`);
  }
  return { ok: hits.length === 0, hits };
}
```

- The exported `guardrail(diff, judgeDeps)` runs `guardrailGrep` first; if grep is clean, it runs ONE small judge call ("does this diff teach by affirmative example, or does it enumerate prohibitions / name an anti-pattern?") and ANDs the verdict. Judge injected for the unit test (grep-only above); real judge reuses Task 7's transport.

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/guardrail.ts eval/access-model/src/guardrail.test.ts
git commit -m "eval(access-model): design-doc guardrail on prompt diff"
```

---

## Task 12: The 5 verify gates (`gates.ts`)

Pure function combining the run's rollup, the baseline rollup, the holdout rollup, the `pnpm check` result, and the guardrail result into `{ pass, failed[] }`. Any failure ⇒ the autoresearch loop reverts the iteration regardless of the metric.

**Files:**
- Create: `eval/access-model/src/gates.ts`
- Test: `eval/access-model/src/gates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { evaluateGates } from "./gates.js";

const base = { twoFileRate: 0.8, renderableRate: 0.9, metric: 0.5 };

describe("evaluateGates", () => {
  it("passes when check+guardrail green and rates >= baseline and holdout not regressed", () => {
    const r = evaluateGates({
      checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.6 },
      baseline: base, holdoutCurrent: { metric: 0.55 }, holdoutBaseline: { metric: 0.5 },
    });
    expect(r.pass).toBe(true);
    expect(r.failed).toEqual([]);
  });
  it("fails on a two-file emission regression (the 9cf43ea-class catch)", () => {
    const r = evaluateGates({ checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.5, renderableRate: 0.92, metric: 0.7 }, baseline: base,
      holdoutCurrent: { metric: 0.55 }, holdoutBaseline: { metric: 0.5 } });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("two-file-emission");
  });
  it("fails on holdout regression beyond the noise band", () => {
    const r = evaluateGates({ checkGreen: true, guardrail: { ok: true, hits: [] },
      current: { twoFileRate: 0.85, renderableRate: 0.92, metric: 0.7 }, baseline: base,
      holdoutCurrent: { metric: 0.3 }, holdoutBaseline: { metric: 0.5 } });
    expect(r.pass).toBe(false);
    expect(r.failed).toContain("holdout-regression");
  });
  it("fails when pnpm check is red or guardrail trips", () => {
    expect(evaluateGates({ checkGreen: false, guardrail: { ok: true, hits: [] }, current: base, baseline: base, holdoutCurrent: { metric: 0.5 }, holdoutBaseline: { metric: 0.5 } }).failed).toContain("check");
    expect(evaluateGates({ checkGreen: true, guardrail: { ok: false, hits: ["x"] }, current: base, baseline: base, holdoutCurrent: { metric: 0.5 }, holdoutBaseline: { metric: 0.5 } }).failed).toContain("guardrail");
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/gates.test.ts`

- [ ] **Step 3: Implement `src/gates.ts`**

```ts
export interface RateSummary { readonly twoFileRate: number; readonly renderableRate: number; readonly metric: number; }
export interface HoldoutSummary { readonly metric: number; }

export interface GatesInput {
  readonly checkGreen: boolean;                 // gate 1: pnpm check + promptAnchor
  readonly guardrail: { ok: boolean; hits: string[] }; // gate 4
  readonly current: RateSummary;
  readonly baseline: RateSummary;
  readonly holdoutCurrent: HoldoutSummary;      // gate 5
  readonly holdoutBaseline: HoldoutSummary;
  readonly noiseBand?: number;                  // tolerance for "regress"; default 0.05
}
export interface GatesResult { readonly pass: boolean; readonly failed: string[]; }

export function evaluateGates(i: GatesInput): GatesResult {
  const band = i.noiseBand ?? 0.05;
  const failed: string[] = [];
  if (!i.checkGreen) failed.push("check");                                            // gate 1
  if (i.current.twoFileRate < i.baseline.twoFileRate - band) failed.push("two-file-emission"); // gate 2
  if (i.current.renderableRate < i.baseline.renderableRate - band) failed.push("renderable");   // gate 3
  if (!i.guardrail.ok) failed.push("guardrail");                                      // gate 4
  if (i.holdoutCurrent.metric < i.holdoutBaseline.metric - band) failed.push("holdout-regression"); // gate 5
  return { pass: failed.length === 0, failed };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/gates.ts eval/access-model/src/gates.test.ts
git commit -m "eval(access-model): 5 verify discard-gates"
```

---

## Task 13: Baseline capture (`baseline.ts`)

The ≥-baseline gates need a frozen baseline run summary (from `9cf43ea`, the issue's baseline commit). `baseline.ts` reads/writes a `baseline.json` (rollup of eval + holdout) under the package so the loop compares against a fixed reference, not the previous iteration.

**Files:**
- Create: `eval/access-model/src/baseline.ts`
- Test: `eval/access-model/src/baseline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { mergeBaseline } from "./baseline.js";

describe("mergeBaseline", () => {
  it("keeps the recorded commit + rollups and refuses to overwrite without force", () => {
    const existing = { commit: "9cf43ea", eval: { metric: 0.4 }, holdout: { metric: 0.4 } };
    expect(() => mergeBaseline(existing, { commit: "abc", eval: { metric: 0.6 }, holdout: { metric: 0.5 } }, false)).toThrow(/baseline exists/);
    const forced = mergeBaseline(existing, { commit: "abc", eval: { metric: 0.6 }, holdout: { metric: 0.5 } }, true);
    expect(forced.commit).toBe("abc");
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/baseline.test.ts`

- [ ] **Step 3: Implement `mergeBaseline(existing, next, force)`** — throw if `existing` set and `!force`; else return `next`. `main()` (run via a `capture-baseline` script) runs generate+score+report for eval+holdout on the current checkout and writes `baseline.json` (used once, on `9cf43ea`, at kickoff).

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/baseline.ts eval/access-model/src/baseline.test.ts
git commit -m "eval(access-model): frozen baseline capture"
```

---

## Task 14: The Verify command (`verify.ts`)

The single shell command `/autoresearch` calls as `Verify:`. Orchestrates: (1) `pnpm check` on prompts pkg + drift-guard; (2) generate+score+report on the eval matrix → metric; (3) generate+score+report on the holdout → holdout metric; (4) compute the prompt diff (`git diff` of `prompts/pkg/`) → guardrail; (5) `evaluateGates` vs `baseline.json`; (6) print `METRIC=<x>` and a `GATES: pass|FAIL(...)` line; exit non-zero on any gate failure (so the loop discards).

**Files:**
- Create: `eval/access-model/src/verify.ts`
- Test: `eval/access-model/src/verify.test.ts` (the pure decision function; subprocess calls injected)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { decideVerify } from "./verify.js";

describe("decideVerify", () => {
  it("exit 0 and prints metric when all gates pass", () => {
    const r = decideVerify({ metric: 0.62, gates: { pass: true, failed: [] } });
    expect(r.exitCode).toBe(0);
    expect(r.lines).toContain("METRIC=0.62");
    expect(r.lines.some((l) => l.startsWith("GATES: pass"))).toBe(true);
  });
  it("exit 1 and reports failed gates (discard) even if metric improved", () => {
    const r = decideVerify({ metric: 0.9, gates: { pass: false, failed: ["two-file-emission"] } });
    expect(r.exitCode).toBe(1);
    expect(r.lines.some((l) => l.includes("two-file-emission"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL.** Run: `cd eval/access-model && pnpm exec vitest --run src/verify.test.ts`

- [ ] **Step 3: Implement `decideVerify({metric, gates})`** → `{ exitCode, lines }` (pure), plus `main()` that wires the real subprocess steps (spawn `pnpm check`, call generate/score/report mains for eval + holdout, read `git diff -- prompts/pkg`, run `guardrail` + `evaluateGates`), prints `lines`, and `process.exit(exitCode)`.

```ts
export interface VerifyInput { readonly metric: number; readonly gates: { pass: boolean; failed: string[] }; }
export interface VerifyDecision { readonly exitCode: number; readonly lines: string[]; }

export function decideVerify(i: VerifyInput): VerifyDecision {
  const lines = [`METRIC=${i.metric}`, i.gates.pass ? "GATES: pass" : `GATES: FAIL(${i.gates.failed.join(",")})`];
  return { exitCode: i.gates.pass ? 0 : 1, lines };
}
```

- [ ] **Step 4: Run → PASS, then Commit**

```bash
git add eval/access-model/src/verify.ts eval/access-model/src/verify.test.ts
git commit -m "eval(access-model): the Verify command (metric + gates -> exit code)"
```

---

## Task 15: End-to-end smoke (manual, no network in CI)

Validate the live path cheaply before the full 64-cell loop, per the issue's "platform issues are infra, not score" discipline.

**Files:** none (operational).

- [ ] **Step 1: Login the CLI** — `npx vibes-diy@latest login` (the `eval` handle). Confirm `npx vibes-diy@latest --version` resolves.

- [ ] **Step 2: Tiny generate** — a 2-prompt × 1-rep run:

```bash
cd eval/access-model
printf '%s\n%s\n' '{"id":"todo","prompt":"A todo list app","dimension":"Form-A","expect":"per-visitor"}' '{"id":"blog","prompt":"My personal blog","dimension":"owner-published","expect":"owner-published"}' > /tmp/am-smoke.jsonl
pnpm run generate -- --prompts /tmp/am-smoke.jsonl --concurrency 2
pnpm run score
pnpm run report
```

Expected: `runs/<ts>/results.json` exists; `METRIC=` printed; `access-summary.md` shows a row per prompt; `access.js` + `App.jsx` pulled under the cell dirs.

- [ ] **Step 3: Sanity-check grades** against the known shapes (todo → per-visitor; blog → owner-published). If a real `access.js` mis-grades, add it as an `invariants.test.ts` fixture and fix the regex (corpus is ground truth).

- [ ] **Step 4: Run the whole package check** — `cd eval/access-model && pnpm exec vitest --run` (all green), then `pnpm check` at root for the prompts package + drift-guard.

- [ ] **Step 5: Commit any fixture/regex fixes**

```bash
git add eval/access-model/src
git commit -m "eval(access-model): smoke-run fixes against the live corpus"
```

---

## Task 16: Runbook + autoresearch wiring

**Files:**
- Create: `eval/access-model/README.md`
- Create: `agents/access-model-autoresearch.md`
- Modify: `CLAUDE.md` (add the agents/ link to the Agent Rules list)

- [ ] **Step 1: Write `eval/access-model/README.md`** — the 3-stage runbook (generate/score/report), the `verify` command, the matrix/holdout/baseline files, the concurrency step-down lever, and the "platform failures are excluded from score, logged as issues" rule.

- [ ] **Step 2: Write `agents/access-model-autoresearch.md`** — the autoresearch config block and loop discipline:

```
Goal:    Newly-generated vibes adopt the access model (#2588) on the default codegen model.
Metric:  composite mean(PASS=1/SOFT=.5/FAIL=0) over the 8-prompt matrix × 8 reps (higher is better)
Verify:  cd eval/access-model && pnpm run verify
Success: metric plateaus (no margin-beyond-noise gain across two confirmation batches) with all 5 gates green
Modify:  prompts/pkg/** (scored: fireproof.md, use-vibe.md, use-viewer.md, both system prompts;
         correctness-only: the other llms/*.md + footers + recovery addenda). NOT prompts/pkg/themes/**.
         Prompt-quality edits MUST land in system-prompt-initial.md (the one-shot invariant).
Frozen:  the grader, both matrices, baseline.json. The loop may not edit what scores it.
```

Document loop discipline from the issue: ≥8 reps; keep only on a margin beyond the noise band; re-confirm a kept win with a second batch (verify-twice); gate each proposed edit through `/autoresearch:predict` before spending a 64-app batch; constrain the modify step to affirmative shape→model grammar informed by the previous iteration's failure breakdown; run unbounded until plateau (`Iterations: unlimited`).

- [ ] **Step 3: Add the link to `CLAUDE.md`** Agent Rules list and **Commit**

```bash
git add eval/access-model/README.md agents/access-model-autoresearch.md CLAUDE.md
git commit -m "eval(access-model): runbook + autoresearch wiring"
```

---

## Self-Review notes (coverage check vs #2602)

- **Scope / modify surface** → Task 16 config block (scored vs correctness-only tiers; themes excluded; initial-template invariant). The harness does not constrain which files the loop edits; that's the loop's `Modify:` surface — documented, not coded.
- **Metric (composite over 8×8 on default model)** → Tasks 6, 1 (reps=8), 2 (pinned model).
- **Static-first grader + one judge** → Tasks 3 (static), 7 + 9 (single judge, multiplayer-only).
- **5 verify gates** → gate 1 (Task 14 wires `pnpm check`), gates 2/3 (Task 4 + Task 12), gate 4 (Task 11), gate 5 (Tasks 12/13 holdout). All combined in Task 12, enforced in Task 14.
- **Loop discipline (≥8 reps, margin beyond noise, verify-twice, predict-gate)** → Task 16 (autoresearch-level, not harness code) + `noiseBand` in Task 12.
- **Concurrency 32 → 16 → 8 step-down** → Task 1 (default 32), Task 8 (`--concurrency` lever), recorded in `run.json`.
- **Platform failures excluded from score + logged as issues** → Tasks 6/8 (`ok=false` excluded), Task 16 (issue-logging rule).
- **Output schema diffable vs the hand baseline** → Task 10 (`results.json` mirrors `eval-2588-access-model-results-*.json`).
- **Frozen grader/matrices/baseline** → Task 16 config + Task 13 (baseline overwrite guard).
- **Default-model pin + bump invalidates baseline** → Task 2 + Task 13.

**Open risk to flag at execution:** the cross-package relative imports from `codegen-matrix` (Task 8) assume `tsx` resolves them; if resolution fails under the monorepo's module settings, fall back to copying the three tiny helpers (`pool.ts`, `backoff.ts`, and the `cellDirName`/`discoverAppSlug` helpers) into `eval/access-model/src/` rather than modifying `codegen-matrix`.
