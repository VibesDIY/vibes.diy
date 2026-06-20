# A3 — Delete the AccessFnDO class

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. **Deploy/verify gate:** A2 must be merged and deployed (so no live path invokes `env.ACCESS_FN_DO`) before this PR deploys.

**Goal:** Remove the `AccessFnDO` Durable Object from every environment — its
bindings, source (`pkg/workers/access-fn.ts`), export, env type — and append a
`deleted_classes` migration. Closes the last open piece of #2265 §1 / #2264 §4.

**Architecture:** After A2, `env.ACCESS_FN_DO` is invoked nowhere (access-fn
eval runs locally on AppSessions via `localInvokeAccessFn`). `AccessFnDO` stored
only transient eval state — never user data — so `deleted_classes` is safe.

**Tech Stack:** Cloudflare Workers (Durable Object migrations), wrangler, TS.

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track A3).
**Template:** the DocNotify retirement
(`../2026-06-09-docnotify-retire/`) — same mechanics, simpler ordering.

---

## Key difference from DocNotify: no cross-script binding

DocNotify needed a two-PR cli-first sequence because cli **cross-script-bound
prod's** `DocNotify` (10061: cannot delete a class while a binding references
it). `AccessFnDO` is a **local** binding in every env, including cli
(`wrangler.toml:343` — `{ name = "ACCESS_FN_DO", class_name = "AccessFnDO" }`,
no `script_name`). Each env owns its own class (each has
`v4 new_classes = ["AccessFnDO"]`). So there is **no cross-script reference** —
AccessFnDO can be retired in **one PR**. Standard prod-before-cli deploy order
applies. `wrangler deploy --dry-run` per env remains the authoritative gate.

## Environment map (wrangler.toml, `vibes.diy/pkg/`)

| Env              | block | `ACCESS_FN_DO` binding | `v4 new_classes` | highest tag |
| ---------------- | ----- | ---------------------- | ---------------- | ----------- |
| top-level (test) | L23   | local                  | yes              | v6          |
| `env.local`      | L82   | local                  | yes              | v6          |
| `env.dev`        | L144  | local                  | yes              | v6          |
| `env.preview`    | L208  | local                  | yes              | v6          |
| `env.prod`       | L271  | local                  | yes              | v6          |
| `env.cli`        | L343  | local                  | yes              | v6          |

All six append `v7 deleted_classes = ["AccessFnDO"]`. Keep every `v1..v6`.

---

## Task 1: Confirm AccessFnDO is dead

- [ ] **Step 1: Grep gate**

```bash
rg -n "env\.ACCESS_FN_DO" vibes.diy --type ts -g '!**/tests/**'
```

Expected: **zero** matches (A2 removed the only invoker). If any remain, stop —
A2 is incomplete.

- [ ] **Step 2: Confirm A2 is live**

Verify A2's PR is merged and deployed to prod (check the deploy tag / CI). Do
not proceed against an environment still running the old code path.

---

## Task 2: Remove source, export, type

**Files:**

- Modify: `vibes.diy/pkg/workers/app.ts` (remove `export { AccessFnDO } from "./access-fn.js"`)
- Delete: `vibes.diy/pkg/workers/access-fn.ts`
- Modify: `vibes.diy/api/types/cf-env.ts` (remove `ACCESS_FN_DO: DurableObjectNamespace;`)

- [ ] **Step 1: Remove the export**

In `pkg/workers/app.ts`, delete the `AccessFnDO` re-export line.

- [ ] **Step 2: Delete the source file**

```bash
git rm vibes.diy/pkg/workers/access-fn.ts
```

- [ ] **Step 3: Remove the env type**

In `api/types/cf-env.ts`, delete `ACCESS_FN_DO: DurableObjectNamespace;`
(line ~42).

- [ ] **Step 4: Fix stale references**

```bash
rg -n "AccessFnDO|access-fn\.js|ACCESS_FN_DO" vibes.diy --type ts -g '!**/tests/**'
```

Resolve any remaining non-test references (comments referring to the DO as live;
`access-fn-unit.test.ts` exercises the local eval module, not the DO — leave
those tests). Build will catch missing-symbol errors.

- [ ] **Step 5: Build + test**

Run: `pnpm build && cd vibes.diy/tests && pnpm test access-fn -- --run`
Expected: clean build; access-fn eval tests (local QuickJS path) still pass.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/workers/app.ts vibes.diy/api/types/cf-env.ts
git commit -m "refactor(do-split): remove AccessFnDO source, export, env type (#2265)"
```

---

## Task 3: wrangler migration — drop bindings + `v7 deleted_classes`

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml` (six env blocks)

- [ ] **Step 1: Edit each env block**

For **each** of the six blocks (top-level, `env.local`, `env.dev`,
`env.preview`, `env.prod`, `env.cli`):

1. Remove the `{ name = "ACCESS_FN_DO", class_name = "AccessFnDO" }` line from
   `durable_objects.bindings`.
2. Append a migration after that block's `v6`:

```toml
[[migrations]]   # or [[env.<name>.migrations]] for the namespaced blocks
tag = "v7"
deleted_classes = ["AccessFnDO"]
```

Keep `v1..v6` intact. Add a comment mirroring the DocNotify `v6` note:
`# v7: AccessFnDO retired — access-fn eval now runs locally on AppSessions
(#2265). Local binding in every env, so no 10061 cross-script ordering.`

- [ ] **Step 2: Dry-run every env (authoritative gate)**

```bash
cd vibes.diy/pkg
for e in "" "--env local" "--env dev" "--env preview" "--env prod" "--env cli"; do
  echo "=== wrangler deploy --dry-run $e ==="
  npx wrangler deploy --dry-run $e 2>&1 | tail -20
done
```

Expected: each env reports the `v7 deleted_classes` migration and **no**
registry error. **Contingency:** if cli (or any env) errors with a
missing/registered-class error after the source is gone, apply the DocNotify
contingency — the `deleted_classes` migration in the same config clears it;
re-run dry-run until clean. Do not deploy any env that does not dry-run clean.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/wrangler.toml
git commit -m "chore(wrangler): delete AccessFnDO class via v7 deleted_classes (#2265)"
```

---

## Task 4: Check, PR, deploy, close issues

- [ ] **Step 1: `pnpm check`**

Run: `pnpm check` → green.

- [ ] **Step 2: PR**

Open the PR (label `agent-created`, @-mention `@CharlieHelps`, subscribe). Body
must call out: single PR (no cross-script ordering, unlike DocNotify);
per-env dry-run output pasted; deploy order prod-before-cli; `deleted_classes`
is irreversible but safe (transient state only).

- [ ] **Step 3: Deploy + verify**

Deploy per `agents/deploy-tags.md`: dry-run, then prod, then cli. After each:
smoke that access-gated writes still work (local eval path) and `app` 200 /
`/api` WS 426. Grep prod logs for any `ACCESS_FN_DO` reference (should be none).

- [ ] **Step 4: Close out**

Tick #2265 §1 and #2264 §4; comment on both with the deploy tags. If those were
the last open items in #2264, close it.
