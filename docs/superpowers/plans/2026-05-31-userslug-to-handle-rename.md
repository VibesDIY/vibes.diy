# userSlug → Semantic Handle Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic `userSlug` identifier throughout the TypeScript codebase (~218 files) with semantically precise names (`ownerHandle`, `userHandle`, `defaultHandle`, `handle`, role-specific variants) — no behavior change, no DB migration.

**Architecture:** Type-driven approach — rename shared type definitions first so the compiler surfaces every callsite as an error. Fix callsites using `sed` for uniform files, manual edits for mixed-semantic files. Drizzle schema fields get explicit column names (`text('user_slug')`) to preserve live DB column names.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL + SQLite schemas), cmd-ts (CLI parser), arktype (runtime type validation), pnpm, vitest

**Spec:** `docs/superpowers/specs/2026-05-31-userslug-to-handle-rename-design.md`

---

## Semantic Naming Quick Reference

| Term | Meaning |
|---|---|
| `ownerHandle` | Handle of whoever owns an app/vibe |
| `userHandle` | Handle of the currently authenticated viewer/session user |
| `defaultHandle` | User's chosen default among multiple handles |
| `handle` | Raw handle string in the handle↔userId binding registry |
| `memberHandle`, `writerHandle` | Role-specific names where clearer locally |

---

## File Map

**Type definitions (anchor layer — touch first):**
- `vibes.diy/vibe/types/index.ts` — `ViewerPayload`, `ReqVibeRegisterFPDb`, `FPDbData`
- `vibes.diy/api/types/asset.ts` — `ReqAssetUploadGrant`, `AssetGrantClaims`
- `vibes.diy/api/types/vibes-diy-api.ts` — `AppSlugUserSlug` pair type

**Drizzle schemas:**
- `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts` — all table definitions
- `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts` — matching SQLite definitions

**Key application files (many more found via compiler):**
- `vibes.diy/vibe/runtime/use-viewer.ts` — `viewer.userSlug` → `viewer.userHandle`
- `vibes.diy/api/svc/public/who-am-i.ts` — response field `userSlug` → `userHandle`
- `vibes.diy/api/svc/public/asset-upload-grant.ts` — `req.userSlug` → `req.ownerHandle`
- `vibes.diy/api/svc/intern/render-vibe.ts` — field accesses on typed objects
- `vibes.diy/pkg/app/routes/settings.tsx` — `defaultUserSlug` → `defaultHandle`
- `vibes.diy/pkg/app/utils/avatarUrl.ts` — `avatarRouteForUserSlug` → `avatarRouteForHandle`
- `vibes.diy/api/impl/firefly-api-adapter.ts` — internal `userSlug` field → `userHandle`

**CLI (backwards-compat changes):**
- `vibes-diy/cli/cmds/push-cmd.ts` — add `--handle`, keep `--user-slug` hidden
- `vibes-diy/cli/cmds/pull-cmd.ts` — add `--handle`, keep `--user-slug` hidden
- `vibes-diy/cli/resolve-user-slug.ts` → `vibes-diy/cli/resolve-handle.ts`
- `vibes-diy/cli/cmds/push-from-dir.ts` — internal rename

**Tests (~44 test files):** Fix via sed after application layer is done.

---

## Task 1: Worktree Setup + Spec Doc

**Files:**
- Create worktree at: `.claude/worktrees/jchris+1946-handle-rename/`
- Cherry-pick: spec doc commits from `jchris/pickathon-visual-review`

- [ ] **Step 1: Verify current state**

```bash
git branch --show-current
git log --oneline -3
```

Expected: on `jchris/pickathon-visual-review`, two spec commits at top.

- [ ] **Step 2: Note spec + plan commit hashes**

```bash
git log --oneline | grep "handle rename\|CLI backwards\|implementation plan" | head -5
```

Copy the three commit hashes (design spec, CLI section, implementation plan) — you'll need them for cherry-pick.

- [ ] **Step 3: Create the worktree branch**

```bash
git worktree add .claude/worktrees/jchris+1946-handle-rename jchris/1946-handle-rename 2>/dev/null \
  || git worktree add .claude/worktrees/jchris+1946-handle-rename -b jchris/1946-handle-rename origin/main
```

- [ ] **Step 4: Cherry-pick spec + plan commits**

```bash
cd .claude/worktrees/jchris+1946-handle-rename
git cherry-pick <spec-commit-1> <spec-commit-2> <plan-commit>
```

Replace with the hashes from Step 2, oldest first. There are three commits: design spec, CLI section addition, and implementation plan.

- [ ] **Step 5: Verify spec doc is present**

```bash
ls docs/superpowers/specs/2026-05-31-userslug-to-handle-rename-design.md
ls docs/superpowers/plans/2026-05-31-userslug-to-handle-rename.md
```

Both files should exist.

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

All subsequent steps run from `.claude/worktrees/jchris+1946-handle-rename/`.

---

## Task 2: Anchor Type Renames

**Files:**
- Modify: `vibes.diy/vibe/types/index.ts`
- Modify: `vibes.diy/api/types/asset.ts`
- Modify: `vibes.diy/api/types/vibes-diy-api.ts`

These renames intentionally break the build — the compiler errors guide the rest of the work.

- [ ] **Step 1: Rename in `vibe/types/index.ts`**

```bash
# ViewerPayload: userSlug → userHandle (only this one field — others in this file are ownerHandle)
# First check what's there:
grep -n "userSlug" vibes.diy/vibe/types/index.ts
```

Then manually apply these targeted renames (the file has mixed semantics):
- `ViewerPayload.userSlug` → `userHandle`
- `ReqVibeRegisterFPDb.userSlug` → `ownerHandle`
- `FPDbData.userSlug` → `ownerHandle`

Use your editor or targeted sed per field name context.

- [ ] **Step 2: Rename in `api/types/asset.ts`**

All `userSlug` in this file → `ownerHandle` (both `ReqAssetUploadGrant` and `AssetGrantClaims`):

```bash
sed -i 's/userSlug/ownerHandle/g' vibes.diy/api/types/asset.ts
```

Verify:
```bash
grep -n "ownerHandle\|userSlug" vibes.diy/api/types/asset.ts
```

Expected: only `ownerHandle`, no `userSlug`.

- [ ] **Step 3: Rename in `api/types/vibes-diy-api.ts`**

Check first — line 122 is `userSlug: "string"` (ownerHandle context), line 239 is a callback parameter:

```bash
grep -n "userSlug" vibes.diy/api/types/vibes-diy-api.ts
```

Rename the type field (line ~122):
```bash
sed -i '122s/userSlug/ownerHandle/' vibes.diy/api/types/vibes-diy-api.ts
```

Line 239 (`onDocChanged` callback `userSlug` parameter) also refers to the app owner → rename to `ownerHandle`:
```bash
sed -i '239s/userSlug/ownerHandle/' vibes.diy/api/types/vibes-diy-api.ts
```

Verify:
```bash
grep -n "userSlug\|ownerHandle" vibes.diy/api/types/vibes-diy-api.ts
```

- [ ] **Step 4: Confirm compiler is now broken (expected)**

```bash
cd vibes.diy && npx tsc --noEmit 2>&1 | head -40
```

Expected: many errors referencing `userSlug` property not found. This confirms the anchor is in place.

- [ ] **Step 5: Commit the anchor**

```bash
git add vibes.diy/vibe/types/index.ts vibes.diy/api/types/asset.ts vibes.diy/api/types/vibes-diy-api.ts
git commit -m "refactor: rename userSlug type fields to semantic handle names (anchor)"
```

---

## Task 3: Drizzle Schema Renames

**Files:**
- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`
- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`

In Drizzle, `text()` without arguments uses the camelCase JS key auto-converted to snake_case as the column name. To rename the JS field while keeping the DB column, pass the old column name explicitly: `ownerHandle: text('user_slug').notNull()`.

- [ ] **Step 1: Rename `sqlUserSlugBinding` variable and its `userSlug` field (PG schema)**

In `vibes-diy-api-schema-pg.ts`:
- Rename the exported variable `sqlUserSlugBinding` → `sqlHandleBinding`
- Rename the `userSlug` field inside that table → `handle: text('user_slug').notNull()`
- Update the index/primaryKey references inside the same table definition that say `table.userSlug` → `table.handle`

```bash
# After manual edits to the table definition, fix all *references* to the exported variable name:
sed -i 's/sqlUserSlugBinding/sqlHandleBinding/g' vibes.diy/api/sql/vibes-diy-api-schema-pg.ts
```

- [ ] **Step 2: Rename `userSlug` fields in all other PG tables**

For each table in `vibes-diy-api-schema-pg.ts` where `userSlug` refers to an app owner:
- `sqlAppSlugBinding.userSlug` → `ownerHandle: text('user_slug').notNull()`
- `sqlApps.userSlug` → `ownerHandle: text('user_slug').notNull()`
- `sqlChatContexts.userSlug` → `ownerHandle: text('user_slug').notNull()`
- `sqlAppSettings.userSlug` → `ownerHandle: text('user_slug').notNull()`
- `sqlAssetUploads.userSlug` → `ownerHandle: text('user_slug').notNull()`

For channel/follow tables:
- `sqlFollows.userSlug` → `handle: text('user_slug').notNull()`
- `sqlFollows.channelUserSlug` → `channelHandle: text('channel_user_slug').notNull()`
- `sqlFollowing.userSlug` → `handle: text('user_slug').notNull()`
- `sqlFollowing.channelUserSlug` → `channelHandle: text('channel_user_slug').notNull()`

For any remaining tables with `userSlug`, apply the contextually correct name + explicit column string.

After editing, update `table.userSlug` references inside index/primaryKey lambdas for each table to match the new field name.

Verify no `userSlug` remains:
```bash
grep -n "userSlug" vibes.diy/api/sql/vibes-diy-api-schema-pg.ts
```

Expected: zero results.

- [ ] **Step 3: Apply same renames to SQLite schema**

Repeat the same field renames in `vibes-diy-api-schema-sqlite.ts`. The SQLite schema mirrors the PG schema structure — apply the identical mapping. Variable name `sqlUserSlugBinding` → `sqlHandleBinding` here too.

```bash
grep -n "userSlug" vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts
```

Expected: zero results after edits.

- [ ] **Step 4: Verify `tables.ts` references**

```bash
grep -n "userSlug\|sqlUserSlugBinding" vibes.diy/api/sql/tables.ts
```

If any references to `sqlUserSlugBinding` or `.userSlug` field accesses exist there, update them to `sqlHandleBinding` / `.handle` (or `.ownerHandle`).

- [ ] **Step 5: Commit schema changes**

```bash
git add vibes.diy/api/sql/
git commit -m "refactor: rename userSlug Drizzle fields to semantic handles, preserve column names"
```

---

## Task 4: Viewer / Auth Layer

**Files:**
- Modify: `vibes.diy/vibe/runtime/use-viewer.ts`
- Modify: `vibes.diy/api/svc/public/who-am-i.ts`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Fix `use-viewer.ts`**

```bash
grep -n "userSlug" vibes.diy/vibe/runtime/use-viewer.ts
```

The JSDoc comment references `userSlug` as a prop — update it to `ownerHandle` (it's the prop to render another user's vibe read-only). Any return value field access on `viewer.userSlug` → `viewer.userHandle`.

```bash
sed -i 's/userSlug/ownerHandle/g' vibes.diy/vibe/runtime/use-viewer.ts
# Then manually fix any viewer.userSlug → viewer.userHandle if the sed was too broad
grep -n "ownerHandle\|userHandle" vibes.diy/vibe/runtime/use-viewer.ts
```

- [ ] **Step 2: Fix `who-am-i.ts`**

```bash
grep -n "userSlug" vibes.diy/api/svc/public/who-am-i.ts
```

Expected callsites (from earlier exploration):
- Line 59: `userSlug: ownerUserSlug` (response field for app owner context) → `ownerHandle: ownerUserSlug`
- Line 96: `item.userSlug` (reading from settings — `defaultHandle` context)
- Line 104/105/109: `.userSlugBinding.userSlug` (Drizzle field — now `.handleBinding.handle`)
- Line 120: `viewer: { userSlug: viewerSlug, ... }` → `viewer: { userHandle: viewerSlug, ... }`

This file has mixed semantics — edit manually guided by the compiler errors after checking each line.

- [ ] **Step 3: Fix `firefly-api-adapter.ts`**

```bash
grep -n "userSlug" vibes.diy/api/impl/firefly-api-adapter.ts
```

Internal `userSlug` field on the class → `userHandle`. The `userSlugOnce` helper field → `userHandleOnce`. The `userSlugOverride` parameter → `userHandleOverride`.

```bash
sed -i 's/userSlug/userHandle/g' vibes.diy/api/impl/firefly-api-adapter.ts
sed -i 's/resolveUserSlug/resolveHandle/g' vibes.diy/api/impl/firefly-api-adapter.ts
```

Verify:
```bash
grep -n "userSlug" vibes.diy/api/impl/firefly-api-adapter.ts
```

Expected: zero results.

- [ ] **Step 4: Fix test file**

```bash
sed -i 's/userSlug/ownerHandle/g' vibes.diy/api/impl/firefly-api-adapter.test.ts
# Check for viewer-context fields that should be userHandle instead:
grep -n "ownerHandle\|userHandle" vibes.diy/api/impl/firefly-api-adapter.test.ts
```

Correct any misapplied renames.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/use-viewer.ts vibes.diy/api/svc/public/who-am-i.ts \
  vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "refactor: viewer/auth layer userSlug → userHandle/ownerHandle"
```

---

## Task 5: Asset Upload Layer

**Files:**
- Modify: `vibes.diy/api/svc/public/asset-upload-grant.ts`
- Modify: `vibes.diy/api/svc/intern/render-vibe.ts`

- [ ] **Step 1: Fix `asset-upload-grant.ts`**

```bash
grep -n "userSlug" vibes.diy/api/svc/public/asset-upload-grant.ts
```

All `userSlug` here refer to the app owner (`req.userSlug`, JWT claim `userSlug`):

```bash
sed -i 's/userSlug/ownerHandle/g' vibes.diy/api/svc/public/asset-upload-grant.ts
```

Verify:
```bash
grep -n "userSlug\|ownerHandle" vibes.diy/api/svc/public/asset-upload-grant.ts
```

Also update Drizzle field access: `vctx.sql.tables.userSlugBinding` → `vctx.sql.tables.handleBinding`, `.userSlug` field access → `.handle`.

- [ ] **Step 2: Fix `render-vibe.ts`**

```bash
grep -n "userSlug" vibes.diy/api/svc/intern/render-vibe.ts
```

The parameter `ownerUserSlug` is already well-named — only fix field accesses on objects whose types were renamed (Drizzle results, API response shapes).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/public/asset-upload-grant.ts vibes.diy/api/svc/intern/render-vibe.ts
git commit -m "refactor: asset upload layer userSlug → ownerHandle"
```

---

## Task 6: Settings + Avatar

**Files:**
- Modify: `vibes.diy/pkg/app/routes/settings.tsx`
- Modify: `vibes.diy/pkg/app/utils/avatarUrl.ts`

- [ ] **Step 1: Fix `settings.tsx`**

```bash
grep -n "userSlug\|defaultUserSlug" vibes.diy/pkg/app/routes/settings.tsx
```

All `defaultUserSlug` → `defaultHandle`. Other `userSlug` locals refer to the authenticated user's own handle → `userHandle`.

```bash
sed -i 's/defaultUserSlug/defaultHandle/g' vibes.diy/pkg/app/routes/settings.tsx
sed -i 's/userSlug/userHandle/g' vibes.diy/pkg/app/routes/settings.tsx
```

Verify:
```bash
grep -n "userSlug\|defaultHandle\|userHandle" vibes.diy/pkg/app/routes/settings.tsx
```

- [ ] **Step 2: Fix `avatarUrl.ts`**

```bash
grep -n "userSlug" vibes.diy/pkg/app/utils/avatarUrl.ts
```

Rename `avatarRouteForUserSlug` → `avatarRouteForHandle` (takes any user's handle):

```bash
sed -i 's/avatarRouteForUserSlug/avatarRouteForHandle/g' vibes.diy/pkg/app/utils/avatarUrl.ts
sed -i 's/userSlug/handle/g' vibes.diy/pkg/app/utils/avatarUrl.ts
```

Also find and update all callers of `avatarRouteForUserSlug` across the codebase:

```bash
grep -rn "avatarRouteForUserSlug" vibes.diy/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Apply `sed -i 's/avatarRouteForUserSlug/avatarRouteForHandle/g'` to each file listed.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/routes/settings.tsx vibes.diy/pkg/app/utils/avatarUrl.ts
git commit -m "refactor: settings defaultHandle and avatarRouteForHandle renames"
```

---

## Task 7: Bulk Compiler-Guided Fix

**Files:** All remaining files with `userSlug` (compiler error list guides this)

- [ ] **Step 1: Get current error list**

```bash
cd vibes.diy && npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/:.*//' | sort -u > /tmp/tsc-errors.txt
wc -l /tmp/tsc-errors.txt
cat /tmp/tsc-errors.txt
```

- [ ] **Step 2: For each file in the error list, determine rename target**

Rule: if a file is entirely in one context (all its `userSlug` refer to app owner), use sed. If mixed, edit manually.

```bash
# Quick check: how many userSlug occurrences in a file
grep -c "userSlug" <file>
```

**Files that are entirely owner context** (all `userSlug` → `ownerHandle`): API service files that deal with apps, Drizzle query results, etc. Apply:

```bash
sed -i 's/\buserSlug\b/ownerHandle/g' <file>
```

**Files that are entirely session-user context** (all `userSlug` → `userHandle`): session/auth helpers. Apply:

```bash
sed -i 's/\buserSlug\b/userHandle/g' <file>
```

**Files with Drizzle table access** containing the renamed binding table:

```bash
sed -i 's/userSlugBinding/handleBinding/g; s/\.userSlug\b/.handle/g' <file>
# Then verify the result makes sense
```

- [ ] **Step 3: Re-run tsc after each batch**

After fixing each logical group of files:

```bash
cd vibes.diy && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Watch the count decrease toward zero.

- [ ] **Step 4: Fix remaining test files**

```bash
# Find all test files still referencing userSlug
grep -rln "userSlug" vibes.diy/tests/ vibes.diy/api/tests/ --include="*.ts"
```

For test fixtures that build request objects or check response shapes, apply the same semantic rules. Most test files are entirely owner-context → bulk sed:

```bash
for f in $(grep -rln "userSlug" vibes.diy/tests/ vibes.diy/api/tests/ --include="*.ts"); do
  sed -i 's/\buserSlug\b/ownerHandle/g' "$f"
done
```

Then grep for any `viewer` test context where `ownerHandle` was incorrectly applied and fix to `userHandle`.

- [ ] **Step 5: Confirm clean build**

```bash
cd vibes.diy && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: 0 errors.

- [ ] **Step 6: Commit bulk fixes**

```bash
git add -A
git commit -m "refactor: bulk compiler-guided userSlug → ownerHandle/userHandle renames"
```

---

## Task 8: CLI Backwards-Compatible Changes

**Files:**
- Modify: `vibes-diy/cli/cmds/push-cmd.ts`
- Modify: `vibes-diy/cli/cmds/pull-cmd.ts`
- Modify: `vibes-diy/cli/cmds/push-from-dir.ts`
- Rename: `vibes-diy/cli/resolve-user-slug.ts` → `vibes-diy/cli/resolve-handle.ts`
- Modify: `vibes-diy/cli/main.ts`

- [ ] **Step 1: Rename resolve-user-slug.ts**

```bash
mv vibes-diy/cli/resolve-user-slug.ts vibes-diy/cli/resolve-handle.ts
sed -i 's/resolveUserSlug/resolveHandle/g' vibes-diy/cli/resolve-handle.ts
```

Verify:
```bash
grep -n "resolveUserSlug\|userSlug" vibes-diy/cli/resolve-handle.ts
```

- [ ] **Step 2: Update imports in all CLI files**

```bash
sed -i 's|resolve-user-slug|resolve-handle|g' vibes-diy/cli/cmds/push-cmd.ts
sed -i 's|resolve-user-slug|resolve-handle|g' vibes-diy/cli/cmds/pull-cmd.ts
sed -i 's/resolveUserSlug/resolveHandle/g' vibes-diy/cli/cmds/push-cmd.ts
sed -i 's/resolveUserSlug/resolveHandle/g' vibes-diy/cli/cmds/pull-cmd.ts
```

- [ ] **Step 3: Add `--handle` flag and keep `--user-slug` deprecated in `push-cmd.ts`**

In `vibes-diy/cli/cmds/push-cmd.ts`, find the `userSlug: option({ long: "user-slug", ... })` block and replace it with two options that both feed the same internal value:

```typescript
handle: option({
  long: "handle",
  description: "Handle to publish under (uses default if omitted)",
  type: string,
  defaultValue: () => "",
  defaultValueIsSerializable: true,
}),
// Deprecated alias kept for backwards compatibility — hidden from help
userSlug: option({
  long: "user-slug",
  type: string,
  defaultValue: () => "",
  defaultValueIsSerializable: true,
}),
```

Then in the command handler, resolve: `args.handle || args.userSlug` as the input to `resolveHandle`.

Also rename the `ReqPush` arktype field `userSlug` → `handle`.

- [ ] **Step 4: Same changes in `pull-cmd.ts`**

Apply the identical pattern — add `--handle` documented option, keep `--user-slug` as a hidden undocumented alias feeding `args.handle || args.userSlug` → `resolveHandle`.

Rename the `ReqPull` arktype field `userSlug` → `handle`.

- [ ] **Step 5: Fix `push-from-dir.ts`**

```bash
sed -i 's/userSlug/handle/g' vibes-diy/cli/cmds/push-from-dir.ts
```

Verify:
```bash
grep -n "userSlug\|handle" vibes-diy/cli/cmds/push-from-dir.ts | head -20
```

- [ ] **Step 6: Fix `main.ts`**

```bash
grep -n "userSlug" vibes-diy/cli/main.ts
sed -i 's/userSlug/ownerHandle/g' vibes-diy/cli/main.ts
```

- [ ] **Step 7: Verify CLI TypeScript compiles**

```bash
cd vibes-diy && npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Fix any remaining errors.

- [ ] **Step 8: Commit CLI changes**

```bash
git add vibes-diy/cli/
git commit -m "refactor: CLI --handle flag (keep --user-slug deprecated alias)"
```

---

## Task 9: Final Check + Follow-Up Issues + PR

- [ ] **Step 1: Run full check suite**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | tee /tmp/check-output.txt
grep -E "error|FAIL|passed|failed" /tmp/check-output.txt | tail -20
```

Fix any failures. Re-run until clean.

- [ ] **Step 2: Confirm zero `userSlug` remain in non-DB-alias positions**

```bash
# Should only find occurrences inside text('user_slug') string literals and comments
grep -rn "userSlug" vibes.diy/ vibes-diy/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.wrangler \
  | grep -v "text('user_slug')\|'user_slug'\|\"user_slug\"\|// " \
  | grep -v ".claude/worktrees"
```

Expected: zero lines.

- [ ] **Step 3: File follow-up issue — DB migration**

```bash
gh issue create \
  --repo VibesDIY/vibes.diy \
  --title "refactor: DB migration rename user_slug columns to owner_handle/handle" \
  --label "technical-debt,agent-created" \
  --body "$(cat <<'EOF'
## Summary

The TypeScript rename of \`userSlug\` → semantic handles (ownerHandle, handle, etc.) preserves DB column names via Drizzle \`text('user_slug')\` overrides.

A follow-up migration is needed to rename the actual Postgres columns and remove the override shims:
- \`user_slug\` → \`owner_handle\` on \`sqlApps\`, \`sqlAppSlugBinding\`, \`sqlChatContexts\`, \`sqlAppSettings\`, \`sqlAssetUploads\`
- \`user_slug\` → \`handle\` on \`sqlHandleBinding\` (was \`sqlUserSlugBinding\`)
- \`channel_user_slug\` → \`channel_handle\` on follow tables

Requires coordinated Postgres migration + Drizzle column alias removal.

Closes: #1946 follow-up
EOF
)"
```

- [ ] **Step 4: File follow-up issue — evaluate batch rename tooling**

```bash
gh issue create \
  --repo VibesDIY/vibes.diy \
  --title "tooling: evaluate grep/sed batch rename for future identifier renames" \
  --label "technical-debt,agent-created" \
  --body "$(cat <<'EOF'
## Context

The \`userSlug\` → semantic handles rename (#1946) touched ~218 files using a type-driven approach (rename types, compiler finds callsites).

## Evaluate approach C

Would a mechanical batch rename have been faster?
- grep all \`userSlug\` occurrences → classify by context (owner/viewer/etc.) → apply targeted sed per group
- Risk: requires up-front semantic classification without compiler feedback
- Benefit: potentially faster for large uniform renames

Evaluate on the next similar rename and document findings in \`agents/\`.
EOF
)"
```

- [ ] **Step 5: Prettier on all changed files**

```bash
npx prettier --write \
  vibes.diy/vibe/types/index.ts \
  vibes.diy/api/types/asset.ts \
  vibes.diy/api/types/vibes-diy-api.ts \
  vibes.diy/api/sql/vibes-diy-api-schema-pg.ts \
  vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts \
  vibes.diy/api/impl/firefly-api-adapter.ts \
  vibes.diy/api/svc/public/who-am-i.ts \
  vibes.diy/api/svc/public/asset-upload-grant.ts \
  vibes.diy/pkg/app/routes/settings.tsx \
  vibes.diy/pkg/app/utils/avatarUrl.ts \
  vibes-diy/cli/resolve-handle.ts \
  vibes-diy/cli/cmds/push-cmd.ts \
  vibes-diy/cli/cmds/pull-cmd.ts \
  vibes-diy/cli/cmds/push-from-dir.ts
```

- [ ] **Step 6: Final pnpm check**

```bash
cd vibes.diy && pnpm check 2>&1 | tee /tmp/final-check.txt
grep -E "error|FAIL|passed|failed" /tmp/final-check.txt | tail -20
```

Expected: all passing.

- [ ] **Step 7: Commit formatting**

```bash
git add -A
git commit -m "style: prettier on all renamed files"
```

- [ ] **Step 8: Push and open PR**

```bash
git push -u origin jchris/1946-handle-rename
gh pr create \
  --repo VibesDIY/vibes.diy \
  --title "refactor: userSlug → semantic handle rename (ownerHandle / userHandle / defaultHandle)" \
  --label "technical-debt,agent-created" \
  --body "$(cat <<'EOF'
## Summary

Closes #1946.

Pure TypeScript rename — no behavior change, no DB migration.

- `ownerHandle` — handle of the app/vibe owner
- `userHandle` — handle of the currently authenticated viewer
- `defaultHandle` — user's chosen default handle (settings)
- `handle` — raw value in the handle↔userId binding registry

CLI: `--handle` is the new documented flag on `push` and `pull`. `--user-slug` kept as a hidden, undocumented deprecated alias.

DB column names are preserved via Drizzle `text('user_slug')` column overrides. DB rename tracked in follow-up issue.

## Test plan

- [ ] `pnpm check` passes (format + build + test + lint)
- [ ] `npx tsc --noEmit` reports zero errors
- [ ] `vibes-diy push --handle <handle>` works
- [ ] `vibes-diy push --user-slug <slug>` still works (deprecated alias)
- [ ] `vibes-diy pull --handle <handle>` works
- [ ] `grep -rn userSlug vibes.diy/ vibes-diy/` returns only Drizzle column string literals

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9: Say**

```bash
echo 'rename done' | say
```
