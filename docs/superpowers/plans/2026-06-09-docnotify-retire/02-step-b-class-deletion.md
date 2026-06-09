# Step B — class deletion (PR B, deploys AFTER cli is live)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]` tracking.

**Goal:** Delete the `DocNotify` class from test/local/dev/preview/prod: remove bindings, append `deleted_classes` migrations, remove the source file, export, and env type.

**Precondition:** PR A is **merged AND cli deployed**. If cli is not live, STOP — prod will hit Cloudflare 10061.

**Branch:** `jchris/docnotify-retire-class` (worktree).

---

### Task 1: Remove DOC_NOTIFY bindings + add deleted_classes migrations

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml` — top-level (test), `[env.local]`, `[env.dev]`, `[env.preview]`, `[env.prod]`. **Do not touch `[env.cli]`.**

- [ ] **Step 1: Remove the five binding lines**

Delete this line from each of the five `durable_objects.bindings` arrays (top-level L22, local L75, dev L134, preview L195, prod L255):

```toml
  { name = "DOC_NOTIFY", class_name = "DocNotify" },
```

- [ ] **Step 2: Append a `v6` deleted_classes migration to each of the five envs**

Top-level (after its `v5`):

```toml
[[migrations]]
tag = "v6"
deleted_classes = ["DocNotify"]
```

And the env-scoped equivalents (use the matching prefix for each block):

```toml
[[env.local.migrations]]
tag = "v6"
deleted_classes = ["DocNotify"]

[[env.dev.migrations]]
tag = "v6"
deleted_classes = ["DocNotify"]

[[env.preview.migrations]]
tag = "v6"
deleted_classes = ["DocNotify"]

[[env.prod.migrations]]
tag = "v6"
deleted_classes = ["DocNotify"]
```

Keep every existing `v1..v5` block. Do **not** add a `v6` to `[env.cli]`.

- [ ] **Step 3: Commit (wrangler only, so each layer is reviewable)**

```bash
git add vibes.diy/pkg/wrangler.toml
git commit -m "chore(do): delete DocNotify class across non-cli envs (#2265)"
```

---

### Task 2: Remove the source file, export, and env type

**Files:**

- Delete: `vibes.diy/pkg/workers/doc-notify.ts`
- Modify: `vibes.diy/pkg/workers/app.ts:26`
- Modify: `vibes.diy/api/types/cf-env.ts:36`

- [ ] **Step 1: Remove the export**

In `vibes.diy/pkg/workers/app.ts`, delete:

```ts
export { DocNotify } from "./doc-notify.js";
```

- [ ] **Step 2: Delete the source file**

```bash
git rm vibes.diy/pkg/workers/doc-notify.ts
```

- [ ] **Step 3: Remove the env type**

In `vibes.diy/api/types/cf-env.ts`, delete:

```ts
DOC_NOTIFY: DurableObjectNamespace;
```

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/workers/app.ts vibes.diy/api/types/cf-env.ts
git commit -m "chore(do): remove DocNotify source, export, and env type (#2265)"
```

---

### Task 3: Fix stale comments that present DocNotify as live

**Files:**

- Modify: `vibes.diy/api/tests/route-decision.test.ts` (test descriptions referencing DocNotify)
- Modify: `vibes.diy/vibe/runtime/firefly-database.ts:120`, `vibes.diy/vibe/runtime/use-firefly.ts:52`
- Modify: `vibes.diy/api/svc/public/app-documents-read-eventos.ts:450`, `app-documents-write-eventos.ts:431,590` (comments saying "DocNotify coordinator")

- [ ] **Step 1: Reword comments**

Change references like "the per-dbName DocNotify DO has a subscriber" / "Notify DocNotify coordinator for cross-shard fan-out" to describe the actual current behavior (per-vibe `localBroadcastCallbacks` fan-out). Do **not** change any test assertions or runtime behavior — comments and `it(...)` description strings only.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs(do): update stale DocNotify comments to current fan-out model (#2265)"
```

---

### Task 4: Verify

- [ ] **Step 1: No live references remain**

```bash
grep -rn "env.DOC_NOTIFY\|export { DocNotify" vibes.diy --include='*.ts'
grep -n 'name = "DOC_NOTIFY"' vibes.diy/pkg/wrangler.toml   # expect only the cli line is gone too; none in test/dev/preview/prod/local
```

Expected: no `env.DOC_NOTIFY`, no export; binding absent from all non-cli blocks.

- [ ] **Step 2: Full check**

```bash
pnpm check 2>&1 | tee /tmp/check.log | tail -25
```

Expected: pass.

- [ ] **Step 3: Per-env dry-run (authoritative gate)**

```bash
cd vibes.diy/pkg
for e in dev preview prod; do echo "== $e =="; npx wrangler deploy --env $e --dry-run 2>&1 | tail -8; done
npx wrangler deploy --dry-run 2>&1 | tail -8   # top-level / test
```

Expected: all succeed. Any error → STOP, do not deploy, reassess (likely a missing/extra migration tag).

---

### Deploy gate (manual, by operator)

- [ ] Confirm PR A (cli) is already live.
- [ ] Open PR B, get review, merge.
- [ ] Deploy in order: dev → preview → **prod last** (prod requires cli already live). Deploy test/local as applicable.
- [ ] Smoke-test: a write in one tab of a vibe still surfaces to another tab of the same vibe.
- [ ] Tick item 1 on #2265.
