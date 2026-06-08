# AppSessions DO split — rename + cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename confusing connection-role names (`vibeDiyApi` → `chatApi`, `appDiyApi` → `vibeApi`), remove stale shard param from app connection URL, add edge case tests for `resolveShardDO`, and file a follow-up issue for deferred work.

**Architecture:** Pure cleanup — no behavior changes. The rename is a mechanical find-replace across 39 files. The shard fix is a one-line constructor config change. The tests exercise an existing 18-line function. One PR, four commits.

**Tech Stack:** TypeScript, React, Vitest

**Issues:** [#2263](https://github.com/VibesDIY/vibes.diy/issues/2263), [#2264](https://github.com/VibesDIY/vibes.diy/issues/2264)
**Spec:** `docs/superpowers/specs/2026-06-08-do-split-rename-cleanup-design.md`

---

## File Map

| File | Change | Task |
|------|--------|------|
| `vibes.diy/pkg/app/vibes-diy-provider.tsx` | Rename `vibeDiyApi` → `chatApi`, `appDiyApi` → `vibeApi` in interface + implementation | 1 |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` | Rename all `vibeDiyApi`/`appDiyApi` destructures | 1 |
| ~35 component/hook/route/test files | Rename `vibeDiyApi` → `chatApi` in destructures and usage | 1 |
| `vibes.diy/api/impl/index.ts` | Add `skipShard` option to `VibesDiyApi` constructor | 2 |
| `vibes.diy/pkg/app/vibes-diy-provider.tsx` | Pass `skipShard: true` for app connection | 2 |
| `vibes.diy/api/tests/resolve-shard-do.test.ts` | New test file — 5 edge case tests | 3 |
| N/A (GitHub) | File follow-up issue for deferred #2264 items | 4 |

---

## Task 1: Rename `vibeDiyApi` → `chatApi`, `appDiyApi` → `vibeApi`

This is a mechanical rename across the entire codebase. No logic changes.

**Files:**
- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx` (interface definition + implementation)
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (26 references)
- Modify: ~35 component/hook/route/test files (see full list below)

**Full file list** (all under `vibes.diy/`):

Provider + sandbox:
- `pkg/app/vibes-diy-provider.tsx`
- `vibe/srv-sandbox/srv-sandbox.ts`

Components:
- `pkg/app/components/DmThread.tsx`
- `pkg/app/components/DmInbox.tsx`
- `pkg/app/components/ModelSettingsCards.tsx`
- `pkg/app/components/RecentVibes.tsx`
- `pkg/app/components/YourAppsFooter.tsx`
- `pkg/app/components/MyAppsSection.tsx`
- `pkg/app/components/ChatInput.tsx`
- `pkg/app/components/ColorsetPicker.tsx`
- `pkg/app/components/ResultPreview/CommentsSection.tsx`
- `pkg/app/components/ResultPreview/MembersSection.tsx`
- `pkg/app/components/ResultPreview/ShareModal.tsx`
- `pkg/app/components/ResultPreview/useShareModal.ts`
- `pkg/app/components/mine/AppChatsTab.tsx`
- `pkg/app/components/mine/sharing-tab/useSharingPanel.ts`
- `pkg/app/components/mine/settings-tab/index.tsx`

Hooks:
- `pkg/app/hooks/useBuildCompletionNotifications.ts`
- `pkg/app/hooks/useRecentVibes.ts`
- `pkg/app/hooks/useMemberships.ts`
- `pkg/app/hooks/useIframeCurrentTokens.ts`

Routes:
- `pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
- `pkg/app/routes/remix.$ownerHandle.$appSlug.tsx`
- `pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx`
- `pkg/app/routes/chat/prompt.tsx`
- `pkg/app/routes/settings.tsx`
- `pkg/app/routes/vibes/mine.tsx`
- `pkg/app/routes/vibes/memberships.tsx`
- `pkg/app/routes/messages.tsx`
- `pkg/app/routes/messages.$ownerHandleA.$ownerHandleB.tsx`
- `pkg/app/routes/settings/csr-to-cert.tsx`

Utils:
- `pkg/app/utils/titleGenerator.ts`

Tests:
- `tests/app/settings-profile.test.tsx`
- `tests/app/ShareModal.test.tsx`
- `tests/app/comments-section-avatar.test.tsx`
- `tests/app/ssr/vibe-route-ssr.test.tsx`
- `api/tests/iframe-source-capture.test.ts`
- `api/tests/srv-sandbox-set-db-acl.test.ts`
- `api/tests/srv-sandbox-put-doc.test.ts`
- `api/tests/srv-sandbox-who-am-i.test.ts`
- `api/tests/srv-sandbox-put-asset.test.ts`
- `api/tests/srv-sandbox-img-gen.test.ts`

### Steps

- [ ] **Step 1: Rename in the type definition and provider**

In `vibes.diy/pkg/app/vibes-diy-provider.tsx`:

1. Rename the interface fields:
```typescript
// Before
export interface VibesDiyCtx {
  sthis: SuperThis;
  vibeDiyApi: VibesDiyApiIface; // rename → chatApi (#2263)
  appDiyApi?: VibesDiyApiIface; // rename → vibeApi (#2263)
  webVars: VibesDiyWebVars;
  srvVibeSandbox: vibesDiySrvSandbox;
  getToken?: () => Promise<Result<DashAuthType>>;
}

// After
export interface VibesDiyCtx {
  sthis: SuperThis;
  chatApi: VibesDiyApiIface;
  vibeApi?: VibesDiyApiIface;
  webVars: VibesDiyWebVars;
  srvVibeSandbox: vibesDiySrvSandbox;
  getToken?: () => Promise<Result<DashAuthType>>;
}
```

2. Find-replace within this file: `vibeDiyApi` → `chatApi` (all occurrences)
3. Find-replace within this file: `appDiyApi` → `vibeApi` (all occurrences)
4. Update comments: remove the `// rename → chatApi (#2263)` markers

- [ ] **Step 2: Rename in srv-sandbox**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, find-replace:
- `vibeDiyApi` → `chatApi` (all occurrences)
- `appDiyApi` → `vibeApi` (all occurrences)

The pattern `const { vibeDiyApi, appDiyApi } = sandbox.args;` becomes `const { chatApi, vibeApi } = sandbox.args;`
The pattern `const api = appDiyApi ?? vibeDiyApi;` becomes `const api = vibeApi ?? chatApi;`

- [ ] **Step 3: Rename across all component, hook, route, and test files**

For every file listed above (components, hooks, routes, utils, tests), do a global find-replace:
- `vibeDiyApi` → `chatApi`
- `appDiyApi` → `vibeApi`

Most files only have `vibeDiyApi` (the chat connection). The pattern is:
```typescript
// Before
const { vibeDiyApi } = useVibesDiy();

// After
const { chatApi } = useVibesDiy();
```

- [ ] **Step 4: Verify the build compiles**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm build 2>&1 | tee /tmp/rename-build.txt
grep -E "error|Error" /tmp/rename-build.txt | head -20
```

Expected: clean build, zero type errors. If any file was missed, the TypeScript compiler will report `Property 'vibeDiyApi' does not exist on type 'VibesDiyCtx'`.

- [ ] **Step 5: Run tests**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm --dir vibes.diy/tests test --reporter=dot 2>&1 | tee /tmp/rename-test.txt
tail -5 /tmp/rename-test.txt
```

Expected: all tests pass. If a test file was missed, it will fail at the destructure.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write $(git diff --name-only)
git add -A
git commit -m "refactor: rename vibeDiyApi → chatApi, appDiyApi → vibeApi (#2263)

Pure mechanical rename — no behavior change. The chat streaming
connection is now chatApi, the vibe-scoped data connection is vibeApi."
```

---

## Task 2: Remove stale `shard` param from app connection URL

The `VibesDiyApi` constructor (in `vibes.diy/api/impl/index.ts`, line ~249) always appends `?shard=<uuid>` to the connection URL. For the app connection (`/api/app?vibe=...`), AppSessions ignores this param. It's cosmetic noise in logs/devtools.

**Files:**
- Modify: `vibes.diy/api/impl/index.ts` (~line 188-250) — add `skipShard` config option
- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx` (~line 243) — pass `skipShard: true` for app connection

### Steps

- [ ] **Step 1: Add `skipShard` option to VibesDiyApi constructor config**

In `vibes.diy/api/impl/index.ts`, find the config interface (around line 188):

```typescript
// Before (around line 194)
readonly shardKey?: string;

// After — add below shardKey
readonly shardKey?: string;
readonly skipShard?: boolean;
```

Then update the URL construction (around line 249):

```typescript
// Before
const shard = cfg.shardKey ?? crypto.randomUUID();
const apiUrl = cfg.ws ? cfg.apiUrl : BuildURI.from(cfg.apiUrl).setParam("shard", shard).toString();

// After
const apiUrl = cfg.ws || cfg.skipShard
  ? cfg.apiUrl
  : BuildURI.from(cfg.apiUrl).setParam("shard", cfg.shardKey ?? crypto.randomUUID()).toString();
```

- [ ] **Step 2: Pass `skipShard: true` for the app connection**

In `vibes.diy/pkg/app/vibes-diy-provider.tsx`, find the `appDiyApi` (now `vibeApi`) constructor call:

```typescript
// Before (now using new name from Task 1)
realCtx.vibeApi = vibesDiyApis.get(appApiUrl).once(() => {
  return new VibesDiyApi({
    apiUrl: appApiUrl,
    getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
  });
});

// After
realCtx.vibeApi = vibesDiyApis.get(appApiUrl).once(() => {
  return new VibesDiyApi({
    apiUrl: appApiUrl,
    skipShard: true,
    getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
  });
});
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm build 2>&1 | tee /tmp/shard-build.txt
grep -E "error|Error" /tmp/shard-build.txt | head -20
```

Expected: clean build.

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/api/impl/index.ts vibes.diy/pkg/app/vibes-diy-provider.tsx
git add vibes.diy/api/impl/index.ts vibes.diy/pkg/app/vibes-diy-provider.tsx
git commit -m "fix: skip stale shard param on app connection URL (#2264)

VibesDiyApi always appended ?shard=<uuid> to the WebSocket URL.
AppSessions ignores this param — it routes by the vibe param instead.
Add skipShard option to suppress it for app connections."
```

---

## Task 3: Add `resolveShardDO` edge case tests

`resolveShardDO` routes shard IDs to the correct DO namespace by prefix. It's 18 lines in `vibes.diy/pkg/workers/resolve-shard-do.ts`. Charlie's review requested edge case coverage.

**Files:**
- Create: `vibes.diy/api/tests/resolve-shard-do.test.ts`
- Reference: `vibes.diy/pkg/workers/resolve-shard-do.ts`
- Reference: `vibes.diy/api/tests/route-decision.test.ts` (for test structure conventions)

### Steps

- [ ] **Step 1: Write the test file**

Create `vibes.diy/api/tests/resolve-shard-do.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveShardDO } from "../../pkg/workers/resolve-shard-do.js";
import type { CFEnv } from "@vibes.diy/api-types";

const APP_SESSIONS = { sentinel: "APP_SESSIONS" } as unknown as CFEnv["APP_SESSIONS"];
const CHAT_SESSIONS = { sentinel: "CHAT_SESSIONS" } as unknown as CFEnv["CHAT_SESSIONS"];

const env = { APP_SESSIONS, CHAT_SESSIONS } as unknown as CFEnv;

describe("resolveShardDO", () => {
  it("app:foo → APP_SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("app:foo", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo (no prefix) → CHAT_SESSIONS with name 'foo'", () => {
    const result = resolveShardDO("foo", env);
    expect(result.ns).toBe(CHAT_SESSIONS);
    expect(result.name).toBe("foo");
  });

  it("foo:bar (unknown prefix) → CHAT_SESSIONS with full input as name", () => {
    const result = resolveShardDO("foo:bar", env);
    expect(result.ns).toBe(CHAT_SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app:foo:bar → APP_SESSIONS with name 'foo:bar' (only first colon is delimiter)", () => {
    const result = resolveShardDO("app:foo:bar", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("foo:bar");
  });

  it("app: (empty suffix) → APP_SESSIONS with empty name", () => {
    const result = resolveShardDO("app:", env);
    expect(result.ns).toBe(APP_SESSIONS);
    expect(result.name).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm --dir vibes.diy/api/tests test resolve-shard-do 2>&1 | tee /tmp/shard-test.txt
tail -10 /tmp/shard-test.txt
```

Expected: 5 tests pass. These test existing behavior, so they should all pass immediately.

- [ ] **Step 3: Format and commit**

```bash
npx prettier --write vibes.diy/api/tests/resolve-shard-do.test.ts
git add vibes.diy/api/tests/resolve-shard-do.test.ts
git commit -m "test: add resolveShardDO edge case tests (#2264)

Cover app:foo, foo, foo:bar, app:foo:bar, and app: inputs per
Charlie's review request on PR #2253."
```

---

## Task 4: File follow-up issue for deferred #2264 items

Three items from #2264 are deferred to separate PRs. File a single tracking issue.

**Files:** None (GitHub only)

### Steps

- [ ] **Step 1: File the follow-up issue**

```bash
gh issue create \
  --title "cleanup: deferred AppSessions DO split follow-ups" \
  --label "agent-created" \
  --body "$(cat <<'EOF'
## Context

Deferred items from #2264 that require separate PRs or coordination.

## Items

- [ ] **DocNotify/AccessFnDO DO class deletion** — Add `deleted_classes` migration to wrangler.toml. Requires traffic to fully drain from old DOs first. Source files (`pkg/workers/doc-notify.ts`, `pkg/workers/access-fn.ts`) can be deleted after the migration deploys.
- [ ] **SharedSessions singleton DO** — Singleton DO for sidebar/settings/models queries. Enables lazy ChatSessions (chat connection only opens on first prompt focus).
- [ ] **`/chat/` route deprecation** — Chat inline on `/vibe/` route with lazy chat connection. Depends on SharedSessions.

## From

- #2264 (cleanup items 3-4 and architecture items)
- Spec: `docs/superpowers/specs/2026-06-05-app-sessions-do-split-design.md` § Later
EOF
)"
```

- [ ] **Step 2: Close resolved issues**

After the PR merges, close #2263 and mark the completed items in #2264 as done (leave #2264 open if deferred items remain, or close it if the new follow-up issue replaces it).

---

## Task 5: Final verification and PR

### Steps

- [ ] **Step 1: Run pnpm fast-check**

```bash
cd /Users/jchris/code/fp/vibes.diy && pnpm fast-check 2>&1 | tee /tmp/final-check.txt
tail -20 /tmp/final-check.txt
```

Expected: all checks pass (format, build, test, lint).

- [ ] **Step 2: Push and create PR**

```bash
git push -u origin HEAD
gh pr create \
  --title "refactor: rename vibeDiyApi/appDiyApi, clean up DO split follow-ups (#2263, #2264)" \
  --body "$(cat <<'EOF'
## Summary

- Rename `vibeDiyApi` → `chatApi` and `appDiyApi` → `vibeApi` across all consumers (39 files, 282 references)
- Skip stale `?shard=<uuid>` param on app connection URL (AppSessions ignores it)
- Add `resolveShardDO` edge case tests per Charlie's review on #2253
- Filed follow-up issue for deferred #2264 items (DO class deletion, SharedSessions, /chat/ deprecation)

## Test plan

- [ ] `pnpm fast-check` passes (format + build + test + lint)
- [ ] Grep confirms zero remaining `vibeDiyApi` or `appDiyApi` references
- [ ] `resolveShardDO` tests cover all 5 edge cases
- [ ] App connection URL in devtools no longer shows `?shard=`

Closes #2263
Partially addresses #2264

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Request review**

```bash
gh pr edit --add-reviewer CharlieHelps
```
