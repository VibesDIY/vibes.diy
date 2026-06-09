# Step A — cli unbinding (PR A, deploys FIRST)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]` tracking.

**Goal:** Remove cli's cross-script `DOC_NOTIFY` binding so prod's `DocNotify` class loses its last external reference, unblocking deletion in Step B.

**Architecture:** Pure `wrangler.toml` edit in the `[env.cli]` block only. No source/code changes. cli's dormant `v2 new_classes=["DocNotify"]` history entry stays.

**Branch:** `jchris/docnotify-retire-cli` (worktree).

---

### Task 1: Drop cli's cross-script DOC_NOTIFY binding

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml` — `[env.cli.durable_objects]` (binding at L323) and comment block (L311–345)

- [ ] **Step 1: Remove the binding line**

In `[env.cli.durable_objects].bindings`, delete:

```toml
  { name = "DOC_NOTIFY", class_name = "DocNotify", script_name = "vibes-diy-v2-prod" },
```

Leave `CHAT_SESSIONS`, `APP_SESSIONS` (cross-script), `USER_NOTIFY` (cross-script), and `ACCESS_FN_DO` bindings unchanged.

- [ ] **Step 2: Update the explanatory comment**

In the comment block above `[env.cli.durable_objects]` (L311–318), replace the DocNotify cross-script rationale with a note that the binding was removed as part of DocNotify retirement (#2265), and that the dormant `v2` history entry is intentionally retained. Keep the `v2 is historical and must stay` note (L332–345) but update its tense to reflect the binding is now gone.

- [ ] **Step 3: Validate config + dry-run cli**

Run:

```bash
cd vibes.diy/pkg
npx wrangler deploy --env cli --dry-run 2>&1 | tail -30
```

Expected: dry-run succeeds. **If it errors about a missing `DocNotify` class (10074-style)** → apply the contingency in Task 2 before proceeding. Otherwise skip Task 2.

- [ ] **Step 4: Repo check**

Run from repo root:

```bash
pnpm fast-check 2>&1 | tail -20
```

Expected: pass (this PR touches only wrangler.toml; no code change).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/wrangler.toml
git commit -m "chore(do): drop cli cross-script DOC_NOTIFY binding (#2265)

First step of DocNotify retirement. Removes cli's cross-script
reference to prod's DocNotify class so prod can delete the class
in the follow-up PR. Deploy cli BEFORE prod."
```

---

### Task 2: CONTINGENCY — only if Step 3 dry-run failed

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml` — append a cli migration

- [ ] **Step 1: Add a deleted_classes migration to cli**

After cli's `v4` migration, append:

```toml
[[env.cli.migrations]]
tag = "v5"
deleted_classes = ["DocNotify"]
```

(Allowed now that the binding is dropped — the 10061 blocker is gone.)

- [ ] **Step 2: Re-run dry-run**

```bash
cd vibes.diy/pkg && npx wrangler deploy --env cli --dry-run 2>&1 | tail -30
```

Expected: succeeds. Amend the Task 1 commit (`git commit --amend --no-edit`) and note the contingency was needed in the PR body.

---

### Deploy gate (manual, by operator)

- [ ] Open PR A, get review, merge.
- [ ] Deploy cli (`vibes-diy-v2-cli`) and confirm live.
- [ ] Only then proceed to [02-step-b-class-deletion.md](02-step-b-class-deletion.md).
