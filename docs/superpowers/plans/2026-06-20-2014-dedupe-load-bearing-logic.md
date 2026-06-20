# De-duplicate load-bearing logic (#2014) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse three copy-paste-synced pieces of logic (db-ACL evaluation, the "latest app per slug" query, and four P2 helpers) to a single source of truth each, with **no behavior change**.

**Architecture:** Three independent, separately-PR'd refactors per the approved spec (`docs/superpowers/specs/2026-06-18-2014-dedupe-load-bearing-logic-design.md`). PR 1 (ACL) is highest-risk (security + package graph); PR 2 (query) and PR 3 (P2 helpers) are low-risk. Each lands as its own PR so a regression bisects cleanly.

**Tech Stack:** TypeScript, pnpm workspaces, arktype, drizzle-orm, vitest.

**Ground-truth notes (verified on `main` @ 2b9cd59, 2026-06-20):**

- `@vibes.diy/api-types` and `@vibes.diy/vibe-types` **depend on each other** (`api/types/package.json:21` ↔ `vibe/types/package.json:13`); `vibe/types/index.ts:1` imports the _values_ `dbAcl`/`queryFilter` from api-types. So vibe-runtime (→ vibe-types → api-types) already transitively pulls api-types at runtime; the "kept local to avoid api-types dep" comment in `db-acl-allows.ts:3-4` is already moot.
- `vibe/types/index.ts:7` re-exports api-types' `DbAcl`. The shared leaf must become the single origin of structural `DbAcl`/`DbAclSubject`, with api-types re-exporting from it (Charlie Q2). Watch for a duplicate-`DbAcl`-export collision in the barrel.
- The current `inGroup`/`aclAllows`/`canRead`/`canWrite` bodies in `vibe/runtime/db-acl-allows.ts` and `api/svc/public/db-acl-resolver.ts` are byte-identical; `access-helpers.ts:10-11` holds the host `canRead`/`canWrite`.

---

## PR 1 — ACL evaluation: one shared module in `@vibes.diy/vibe-types`

**Branch:** `claude/dedupe-acl-eval-2014`

### File structure (PR 1)

- **Create** `vibes.diy/vibe/types/db-acl-eval.ts` — leaf module: structural `DbAcl`/`DbAclSubject` + `canRead`/`canWrite`/`inGroup`/`aclAllows`. Imports nothing from `@vibes.diy/api-types`.
- **Modify** `vibes.diy/vibe/types/index.ts` — re-export the leaf; resolve the `DbAcl` re-export so there is exactly one `DbAcl` exported.
- **Modify** `vibes.diy/api/types/db-acls.ts` — keep the `dbAcl`/`dbAclSubject` arktype _validators_; make the exported structural `DbAcl`/`DbAclSubject` types re-exports of the leaf (single origin).
- **Modify** `vibes.diy/vibe/runtime/db-acl-allows.ts` — delete local bodies; re-export from the shared module (preserve current export surface for `@vibes.diy/vibe-runtime` consumers + the parity test).
- **Modify** `vibes.diy/api/svc/public/db-acl-resolver.ts` — import `inGroup`/`aclAllows` from the shared module; delete local copies. Keep `resolveDbAcl`/`checkDirectChannelAccess`.
- **Modify** `vibes.diy/api/svc/public/access-helpers.ts` — re-export `canRead`/`canWrite` from the shared module (shim) instead of defining them.
- **Modify** `vibes.diy/api/tests/db-acl-allows-parity.test.ts` — convert to a same-function-reference assertion (Charlie Q5).

### Task 1.1: Branch from latest main

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull origin main
git checkout -b claude/dedupe-acl-eval-2014
```

### Task 1.2: Create the shared leaf module

**Files:** Create `vibes.diy/vibe/types/db-acl-eval.ts`

- [ ] **Step 1: Write the module** (bodies copied verbatim from the current host/runtime copies; `DocAccessLevel` type-imported from the vibe-types barrel — type-only, erased at runtime, so it adds no api-types runtime edge)

```ts
import type { DocAccessLevel } from "./index.js";

// Single source of truth for db-ACL evaluation, shared by @vibes.diy/api-svc
// (host) and @vibes.diy/vibe-runtime (client). Lives in @vibes.diy/vibe-types
// because both packages already depend on it. LEAF MODULE: imports nothing from
// @vibes.diy/api-types, so api-types can `import type` the structural DbAcl /
// DbAclSubject from here without a runtime cycle.
export type DbAclSubject = "members" | "editors" | "submitters" | "readers";
export interface DbAcl {
  read?: DbAclSubject[];
  write?: DbAclSubject[];
  delete?: DbAclSubject[];
}

export const canRead = (level: DocAccessLevel): boolean => level === "override" || level === "editor" || level === "viewer";

export const canWrite = (level: DocAccessLevel): boolean => level === "override" || level === "editor" || level === "submitter";

export function inGroup(level: DocAccessLevel, group: DbAclSubject): boolean {
  if (level === "override") return true;
  switch (group) {
    case "members":
      return level === "editor" || level === "viewer" || level === "submitter";
    case "editors":
      return level === "editor";
    case "submitters":
      return level === "submitter";
    case "readers":
      return level === "editor" || level === "viewer";
  }
}

export function aclAllows(acl: DbAcl | undefined, cap: "read" | "write" | "delete", access: DocAccessLevel): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access) : canWrite(access);
  }
  return subjects.some((g) => inGroup(access, g));
}
```

- [ ] **Step 2: Commit**

```bash
git add vibes.diy/vibe/types/db-acl-eval.ts
git commit -m "refactor(acl): add shared db-acl-eval leaf module in vibe-types"
```

### Task 1.3: Wire vibe-types barrel + api-types to the leaf (single DbAcl origin)

**Files:** Modify `vibes.diy/vibe/types/index.ts`, `vibes.diy/api/types/db-acls.ts`

- [ ] **Step 1: api-types re-exports structural types from the leaf.** In `db-acls.ts`, keep the arktype validators (`dbAclSubject`, `dbAcl`, `isDbAcl`, `COMMENTS_*`, `ActiveDbAcl`) but replace `export type DbAclSubject = typeof dbAclSubject.infer;` / `export type DbAcl = typeof dbAcl.infer;` with type re-exports from the leaf:

```ts
// Structural types live in the shared leaf (single source of truth); the
// arktype validators below still describe the same shape for runtime validation.
export type { DbAcl, DbAclSubject } from "@vibes.diy/vibe-types/db-acl-eval";
```

Resolve the leaf import path: if `@vibes.diy/vibe-types/db-acl-eval` does not already resolve (check `vibe/types/package.json` `exports`), prefer adding the leaf to the existing barrel and importing `from "@vibes.diy/vibe-types"` **only if** that does not reintroduce the duplicate-`DbAcl` export. If a subpath export entry is unavoidable, add the minimal `exports` map entry and note it in the PR (the spec's import-map constraint says verify it resolves without _new_ entries — if one is required, call it out).

- [ ] **Step 2: vibe-types barrel exposes the leaf without colliding.** In `vibe/types/index.ts`, the line `import { dbAcl, queryFilter, type DbAcl } from "@vibes.diy/api-types";` + `export type { DbAcl };` currently re-exports api-types' `DbAcl`. Since api-types' `DbAcl` now _originates_ from the leaf, re-export `DbAcl`/`DbAclSubject` from the leaf instead and drop the `type DbAcl` from the api-types import:

```ts
import { dbAcl, queryFilter } from "@vibes.diy/api-types";
export type { DbAcl, DbAclSubject } from "./db-acl-eval.js";
export { canRead, canWrite, inGroup, aclAllows } from "./db-acl-eval.js";
```

- [ ] **Step 2b: Verify no duplicate export.** Run: `pnpm -C vibes.diy/vibe/types build` (or workspace build) — expect no "Duplicate identifier 'DbAcl'" / "already exported" error.

- [ ] **Step 3: Build to verify the package graph compiles**

Run: `pnpm build`
Expected: PASS (no cycle error, no duplicate-export error).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/vibe/types/index.ts vibes.diy/api/types/db-acls.ts vibes.diy/vibe/types/package.json
git commit -m "refactor(acl): make db-acl-eval the single origin of DbAcl/DbAclSubject"
```

### Task 1.4: Point runtime + host + access-helpers at the shared module

**Files:** Modify `vibes.diy/vibe/runtime/db-acl-allows.ts`, `vibes.diy/api/svc/public/db-acl-resolver.ts`, `vibes.diy/api/svc/public/access-helpers.ts`

- [ ] **Step 1: Replace runtime body with a re-export.** Full new contents of `db-acl-allows.ts` (preserves the `@vibes.diy/vibe-runtime` export surface — `DbAcl`, `DbAclSubject`, `canRead`, `canWrite`, `inGroup`, `aclAllows` — that the parity test and other consumers import):

```ts
// ACL evaluation is defined once in @vibes.diy/vibe-types (db-acl-eval). This
// module re-exports it to keep the vibe-runtime public surface stable.
export type { DbAcl, DbAclSubject } from "@vibes.diy/vibe-types";
export { canRead, canWrite, inGroup, aclAllows } from "@vibes.diy/vibe-types";
```

- [ ] **Step 2: Host resolver imports the shared eval.** In `db-acl-resolver.ts`: delete the local `inGroup` (lines 8-25) and the local `aclAllows` (lines 84-93). Update imports: keep `DbAcl`, `DbAclSubject` from api-types (now leaf-originated), import `inGroup`/`aclAllows` from the shared module. Replace line 4 region:

```ts
import { COMMENTS_DB_NAME, COMMENTS_DEFAULT_ACL, DbAcl, DbAclSubject, directChannelParticipants } from "@vibes.diy/api-types";
import { aclAllows, inGroup } from "@vibes.diy/vibe-types";
import { DocAccessLevel, canRead, canWrite } from "./access-helpers.js";
```

(`canRead`/`canWrite` continue to come from `access-helpers.js`, which now re-exports them — see Step 3. `DocAccessLevel` stays sourced from `access-helpers.js`. `inGroup`/`aclAllows` are now imported, not defined.)

- [ ] **Step 3: access-helpers re-exports canRead/canWrite (shim).** In `access-helpers.ts`, replace the local definitions (lines 10-11) with a re-export, keeping the `DocAccessLevel` alias local:

```ts
export type DocAccessLevel = Role | "override" | "none";
export { canRead, canWrite } from "@vibes.diy/vibe-types";
```

- [ ] **Step 4: Build + targeted tests**

Run: `pnpm build && cd vibes.diy/tests && pnpm test db-acl-allows comments-acl who-am-i`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/db-acl-allows.ts vibes.diy/api/svc/public/db-acl-resolver.ts vibes.diy/api/svc/public/access-helpers.ts
git commit -m "refactor(acl): source inGroup/aclAllows/canRead/canWrite from shared module"
```

### Task 1.5: Convert the parity test to a same-reference assertion

**Files:** Modify `vibes.diy/api/tests/db-acl-allows-parity.test.ts`

- [ ] **Step 1: Rewrite the test** (Charlie Q5 — assert both package exports resolve to the identical function, plus one smoke call)

```ts
import { describe, it, expect } from "vitest";
import { aclAllows as hostAcl } from "@vibes.diy/api-svc/public/db-acl-resolver.js";
import { aclAllows as clientAcl } from "@vibes.diy/vibe-runtime";

describe("aclAllows host/client are the same shared implementation", () => {
  it("both package exports resolve to the identical function reference", () => {
    expect(clientAcl).toBe(hostAcl);
  });

  it("smoke: the shared impl still evaluates a representative case", () => {
    expect(clientAcl({ write: ["editors"] }, "write", "editor")).toBe(true);
    expect(clientAcl({ write: ["editors"] }, "write", "viewer")).toBe(false);
  });
});
```

Note: `db-acl-resolver.js` no longer defines `aclAllows` but re-exports the shared one via its `import`/`export`. If `aclAllows` is imported-not-re-exported there, the parity import path breaks — ensure `db-acl-resolver.ts` still **exports** `aclAllows` (re-export the imported symbol: `export { aclAllows } from "@vibes.diy/vibe-types";` if the test path must keep resolving). Verify the test's two import paths both still export `aclAllows` before asserting `toBe`.

- [ ] **Step 2: Run it**

Run: `cd vibes.diy/tests && pnpm test db-acl-allows-parity`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/db-acl-allows-parity.test.ts
git commit -m "test(acl): assert host/client aclAllows are the same shared impl"
```

### Task 1.6: Full verification + PR

- [ ] **Step 1: Full gate**

Run: `pnpm check`
Expected: format + build + test + lint PASS (rerun any flaky suite in isolation per `agents/flaky-tests.md`; CI's external-LLM flake is tracked in #2481/#2425/#2426).

- [ ] **Step 2: Duplication greps (expect ONE non-test hit)**

```bash
rg -ln "export function inGroup|export (const|function) aclAllows" vibes.diy --glob '*.ts' --glob '!*node_modules*' --glob '!*.test.*'
```

Expected: only `vibes.diy/vibe/types/db-acl-eval.ts`.

- [ ] **Step 3: Push + open PR**, label `agent-created`, comment @-mention `@CharlieHelps`, subscribe.

---

## PR 2 — "latest app per slug" query: one helper

**Branch:** `claude/dedupe-app-selection-2014`

### File structure (PR 2)

- **Create** `vibes.diy/api/svc/public/select-app.ts` — `selectLatestAppPerSlug(vctx, { userSlug, appSlug })` returning the production-winning row or `undefined`.
- **Modify** `vibes.diy/api/svc/public/get-app-by-fsid.ts:116-146` — call the helper; keep the `fsId`-present fast path inline.
- **Modify** `vibes.diy/api/svc/public/fork-app.ts:80-110` — call the helper; keep its fast path inline.

### Task 2.1: Characterize before moving

- [ ] **Step 1:** Confirm the two query blocks are byte-identical except for the result variable (`app` vs `src`). Read both ranges and diff mentally; if they differ in `select({...})` projection, the helper must return the superset both callers use — verify the projected columns match before extracting.

### Task 2.2: Extract the helper

**Files:** Create `vibes.diy/api/svc/public/select-app.ts`

- [ ] **Step 1: Write the helper** — move the `maxCreatedSub` + `innerJoin` + `orderBy(mode)` + `rows[rows.length-1]` block verbatim into:

```ts
import { and, eq, max } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";

// Resolve the latest app row for (userSlug, appSlug), preferring production.
// orderBy(mode) sorts "dev" < "production", so the last row wins.
export async function selectLatestAppPerSlug(
  vctx: VibesApiSQLCtx,
  req: { readonly userSlug: string; readonly appSlug: string }
): Promise<(typeof rows)[number] | undefined> {
  // ...moved query body verbatim; return rows[rows.length - 1];
}
```

(Fill the body from `get-app-by-fsid.ts:116-146` exactly; type the return as the row type both callers expect — extract via the drizzle select inference, not `any`.)

- [ ] **Step 2: Build.** Run `pnpm -C vibes.diy/api build`. Expected: PASS.

### Task 2.3: Rewire both callers, verify, commit, PR

- [ ] Replace each query block with `const app = await selectLatestAppPerSlug(vctx, { userSlug: req.userSlug, appSlug: req.appSlug });` (and `src` in fork-app), keeping each `fsId` fast path inline.
- [ ] Run: `cd vibes.diy/tests && pnpm test get-app fork-app` then `pnpm check`. Expected: PASS.
- [ ] Grep `rg -n "max_created" vibes.diy/api/svc` → expect ONE hit (`select-app.ts`).
- [ ] Commit, push, open PR, label, @-mention `@CharlieHelps`, subscribe.

---

## PR 3 — P2 helpers: one definition each

**Branch:** `claude/dedupe-p2-helpers-2014`

### File structure (PR 3)

- **Create** `vibes.diy/api/svc/public/report-dates.ts` — `last30DaysUTC(): string[]`.
- **Create** `vibes.diy/api/svc/usage-report/usage-report-util.ts` — `loadDevVars(): void`, `formatError(error: unknown): string` (the **inspect-db superset** that unwraps nested `error.message`; Q7).
- **Create/locate** one `deriveDisplayName(claims: ClerkClaim): string` helper; export from a shared module and update call sites.

### Task 3.1: `last30DaysUTC`

- [ ] Move the body (identical in `report-growth-memberships.ts:20`, `report-growth-vibes-with-data.ts:19`, `report-active-members.ts:20`) into `report-dates.ts`; import in all three; fold `inspect-db-report.ts:44` `last30Days` only if shapes match exactly.
- [ ] `pnpm check`; grep `rg -n "function last30DaysUTC" vibes.diy` → ONE hit. Commit.

### Task 3.2: `loadDevVars` + `formatError`

- [ ] Move `loadDevVars` (identical ×3) into `usage-report-util.ts`.
- [ ] Move `formatError` adopting the **inspect-db.ts:275 superset** (nested `error.message` unwrap). Add a comment: "superset of the former admin-db/inspect-db copies; strictly-additive for admin-db (Q7)."
- [ ] Update `admin-db.ts`, `inspect-db.ts`, `inspect-db-report.ts` imports. `pnpm check`. Commit.

### Task 3.3: `deriveDisplayName` / `deriveAuthorDisplay`

- [ ] Confirm the three bodies (`who-am-i.ts:28`, `list-members.ts:23`, `get-app-by-fsid.ts:44`) are identical modulo name. Export one `deriveDisplayName(claims: ClerkClaim)` from a shared module (e.g. alongside `who-am-i` or a new `derive-display-name.ts`), import in all three, delete "keep aligned with" comments.
- [ ] `pnpm check`; grep `rg -n "function deriveDisplayName|function deriveAuthorDisplay" vibes.diy` → ONE hit. Commit, push, open PR, label, @-mention `@CharlieHelps`, subscribe.

---

## Self-review

**Spec coverage:** PR 1 ↔ spec §1 + Q2/Q3/Q5; PR 2 ↔ spec §2 + Q4; PR 3 ↔ spec §3-5 + Q7. Event-schema item (Q1) intentionally out of scope (already removed). ✓
**Placeholder scan:** PR 2/3 task bodies say "move verbatim" and point at exact line ranges rather than re-pasting the long query/helper bodies — acceptable because the move is literal and the source lines are cited; the executor copies the exact current text. PR 1 (highest risk) has full code inline. ✓
**Type consistency:** `DbAcl`/`DbAclSubject`/`DocAccessLevel`/`aclAllows`/`inGroup`/`canRead`/`canWrite` names are used identically across tasks. ✓
**Risk flags surfaced:** bidirectional api-types↔vibe-types dep; barrel `DbAcl` re-export collision; possible `exports`-map entry for the leaf subpath — all called out in Task 1.3.
