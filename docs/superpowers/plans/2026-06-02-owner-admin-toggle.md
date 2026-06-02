# Owner Admin Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate owner identity from permissions — owner always reports as `"owner"` but ACL checks default to editor-level, with an admin toggle for full bypass.

**Architecture:** `adminMode` boolean flows through ViewerEnv (internal, not exposed to vibe code). Client-side `can()` and server-side `aclAllows()`/`canRead()`/`canWrite()` treat owner as editor when `adminMode` is false. The `/vibe/` route chrome has an owner-only toggle. When admin mode is on, access functions are not executed for reads or writes.

**Tech Stack:** TypeScript, arktype schemas, React, vitest

**Spec:** [docs/superpowers/specs/2026-06-02-owner-admin-toggle-design.md](../specs/2026-06-02-owner-admin-toggle-design.md)

**Issue:** [#2166](https://github.com/VibesDIY/vibes.diy/issues/2166)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `vibes.diy/vibe/runtime/db-acl-allows.ts` | Modify | Add `adminMode` param to `canRead`, `canWrite`, `inGroup`, `aclAllows` |
| `vibes.diy/api/tests/db-acl-allows.test.ts` | Modify | Test owner-as-editor behavior and admin bypass |
| `vibes.diy/vibe/runtime/use-viewer.ts` | Modify | Read `adminMode` internally, add `isOwner`, thread through `can()` |
| `vibes.diy/tests/app/use-viewer.test.tsx` | Modify | Test owner `can()` with/without adminMode |
| `vibes.diy/vibe/runtime/vibe.ts` | Modify | Add `"adminMode?"` to `viewerEnv` schema |
| `vibes.diy/vibe/types/index.ts` | Modify | Add `"adminMode?"` to `EvtVibeViewerChanged` and `ResVibeWhoAmI` |
| `vibes.diy/api/svc/public/db-acl-resolver.ts` | Modify | Add `adminMode` param to server-side `inGroup`, `aclAllows` |
| `vibes.diy/api/svc/public/access-helpers.ts` | Modify | Add `adminMode` param to server-side `canRead`, `canWrite` |
| `vibes.diy/api/svc/public/app-documents.ts` | Modify | Thread `adminMode` through ACL checks; skip access fn when admin |
| `vibes.diy/api/svc/public/who-am-i.ts` | Modify | Accept `adminMode` param, include in response |
| `vibes.diy/api/svc/intern/render-vibe.ts` | Modify | Pass `adminMode` through `buildViewerEnvForRender` |
| `vibes.diy/api/svc/public/access-function.ts` | Modify | Wire `makeHelpers()` to use grant state (align with AccessFnDO) |
| `vibes.diy/api/tests/access-function.test.ts` | Modify | Update tests for grant-aware `makeHelpers()` |
| `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` | Modify | Admin toggle UI, localStorage persistence, re-issue whoAmI |

---

### Task 1: Client-side ACL — add `adminMode` to `db-acl-allows.ts`

**Files:**
- Modify: `vibes.diy/vibe/runtime/db-acl-allows.ts`
- Test: `vibes.diy/api/tests/db-acl-allows.test.ts`

- [ ] **Step 1: Write failing tests for owner-as-editor behavior**

Add these tests to the existing `describe("aclAllows (client port)")` block in `vibes.diy/api/tests/db-acl-allows.test.ts`:

```typescript
it("owner without adminMode evaluates as editor for reads", () => {
  expect(aclAllows(undefined, "read", "owner", false)).toBe(true);
  expect(aclAllows({ read: ["editors"] }, "read", "owner", false)).toBe(true);
  expect(aclAllows({ read: ["submitters"] }, "read", "owner", false)).toBe(false);
});

it("owner without adminMode evaluates as editor for writes", () => {
  expect(aclAllows(undefined, "write", "owner", false)).toBe(true);
  expect(aclAllows({ write: ["editors"] }, "write", "owner", false)).toBe(true);
  expect(aclAllows({ write: ["submitters"] }, "write", "owner", false)).toBe(false);
});

it("owner with adminMode=true bypasses everything (current behavior)", () => {
  expect(aclAllows({ write: ["submitters"] }, "write", "owner", true)).toBe(true);
  expect(aclAllows({ read: ["submitters"] }, "read", "owner", true)).toBe(true);
});

it("adminMode has no effect on non-owner levels", () => {
  expect(aclAllows(undefined, "read", "viewer", false)).toBe(true);
  expect(aclAllows(undefined, "read", "viewer", true)).toBe(true);
  expect(aclAllows(undefined, "write", "viewer", false)).toBe(false);
  expect(aclAllows(undefined, "write", "viewer", true)).toBe(false);
});

it("owner with adminMode=undefined evaluates as editor (default off)", () => {
  expect(aclAllows({ write: ["submitters"] }, "write", "owner")).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy && pnpm vitest run api/tests/db-acl-allows.test.ts`
Expected: FAIL — `aclAllows` doesn't accept a 4th argument yet.

- [ ] **Step 3: Add `adminMode` parameter to all functions**

In `vibes.diy/vibe/runtime/db-acl-allows.ts`, replace the entire file with:

```typescript
import type { DocAccessLevel } from "@vibes.diy/vibe-types";

export type DbAclSubject = "members" | "editors" | "submitters" | "readers";
export interface DbAcl {
  read?: DbAclSubject[];
  write?: DbAclSubject[];
  delete?: DbAclSubject[];
}

function effective(level: DocAccessLevel, adminMode?: boolean): DocAccessLevel {
  return level === "owner" && !adminMode ? "editor" : level;
}

export const canRead = (level: DocAccessLevel, adminMode?: boolean): boolean => {
  const eff = effective(level, adminMode);
  return eff === "owner" || eff === "editor" || eff === "viewer";
};

export const canWrite = (level: DocAccessLevel, adminMode?: boolean): boolean => {
  const eff = effective(level, adminMode);
  return eff === "owner" || eff === "editor" || eff === "submitter";
};

export function inGroup(level: DocAccessLevel, group: DbAclSubject, adminMode?: boolean): boolean {
  const eff = effective(level, adminMode);
  if (eff === "owner") return true;
  switch (group) {
    case "members":
      return eff === "editor" || eff === "viewer" || eff === "submitter";
    case "editors":
      return eff === "editor";
    case "submitters":
      return eff === "submitter";
    case "readers":
      return eff === "editor" || eff === "viewer";
  }
}

export function aclAllows(acl: DbAcl | undefined, cap: "read" | "write" | "delete", access: DocAccessLevel, adminMode?: boolean): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access, adminMode) : canWrite(access, adminMode);
  }
  return subjects.some((g) => inGroup(access, g, adminMode));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy && pnpm vitest run api/tests/db-acl-allows.test.ts`
Expected: All tests PASS. Existing tests still pass because the old call signatures (no `adminMode` arg) default to `undefined`, which means `!adminMode` is `true`, which means owner evaluates as editor — **wait, this changes existing test behavior.**

The existing tests pass `"owner"` without `adminMode` and expect bypass behavior:
```typescript
expect(aclAllows(undefined, "read", "owner")).toBe(true);  // still true — canRead("editor") is true
expect(aclAllows({ write: ["editors"] }, "write", "owner")).toBe(true);  // still true — owner-as-editor is in "editors"
```

Check: the existing test `"editors group is editor + owner"` asserts:
```typescript
expect(aclAllows({ write: ["editors"] }, "write", "owner")).toBe(true);
```
Owner-as-editor IS in the "editors" group, so this still passes. But:
```typescript
expect(aclAllows({ write: ["submitters"] }, "write", "owner")).toBe(true);
```
This would now FAIL because owner-as-editor is NOT in "submitters". Check whether this test exists.

Looking at existing tests: the test `"submitters group is submitter + owner"` only tests `submitter` and `viewer`, not `owner`. The `"members group"` test includes `owner` and expects `true` — owner-as-editor IS in members, so it passes.

The test `"editors group is editor + owner"` tests `owner` and expects `true` — owner-as-editor IS in editors, so it passes.

This is a behavior change: existing callers that pass `"owner"` without `adminMode` will now get editor-level results instead of bypass. This is intentional — the default is admin off. But we need to verify no existing test breaks.

Run the full suite: `cd vibes.diy && pnpm vitest run api/tests/db-acl-allows.test.ts`

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/db-acl-allows.ts vibes.diy/api/tests/db-acl-allows.test.ts
git commit -m "feat: owner ACL checks default to editor, admin bypass opt-in (#2166)"
```

---

### Task 2: ViewerEnv schema — add `adminMode` field

**Files:**
- Modify: `vibes.diy/vibe/runtime/vibe.ts:21-26`
- Modify: `vibes.diy/vibe/types/index.ts:596-602` (ResVibeWhoAmI)
- Modify: `vibes.diy/vibe/types/index.ts:654-660` (EvtVibeViewerChanged)

- [ ] **Step 1: Add `adminMode` to `viewerEnv` in vibe.ts**

In `vibes.diy/vibe/runtime/vibe.ts`, change the `viewerEnv` type:

```typescript
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "adminMode?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

- [ ] **Step 2: Add `adminMode` to `ResVibeWhoAmI` in vibe/types/index.ts**

In `vibes.diy/vibe/types/index.ts`, find the `ResVibeWhoAmI` type (around line 596) and add `"adminMode?"`:

```typescript
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "adminMode?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
}).and(Base);
```

- [ ] **Step 3: Add `adminMode` to `EvtVibeViewerChanged` in vibe/types/index.ts**

Find the `EvtVibeViewerChanged` type (around line 654) and add `"adminMode?"`:

```typescript
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "adminMode?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

- [ ] **Step 4: Run type check**

Run: `cd vibes.diy && pnpm tsc --noEmit`
Expected: No type errors. The field is optional so all existing code is compatible.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/types/index.ts
git commit -m "feat: add adminMode field to ViewerEnv and bridge types (#2166)"
```

---

### Task 3: `useViewer()` — thread `adminMode` through `can()`, add `isOwner`

**Files:**
- Modify: `vibes.diy/vibe/runtime/use-viewer.ts`
- Test: `vibes.diy/tests/app/use-viewer.test.tsx`

- [ ] **Step 1: Write failing tests**

Add these tests to the existing `describe("useViewer")` block in `vibes.diy/tests/app/use-viewer.test.tsx`:

```typescript
it("isOwner is true when access is owner", () => {
  const r = renderWith(baseEnv);
  expect(r.isOwner).toBe(true);
});

it("isOwner is false for non-owner access levels", () => {
  const r = renderWith({ ...baseEnv, access: "editor" as const });
  expect(r.isOwner).toBe(false);
});

it("owner without adminMode: can(write) evaluates as editor", () => {
  const r = renderWith({
    ...baseEnv,
    access: "owner" as const,
    dbAcls: { restrictedDb: { write: ["submitters"] } },
  });
  // owner-as-editor is NOT in "submitters" group
  expect(r.can("write", "restrictedDb")).toBe(false);
  // but access identity is still "owner"
  expect(r.access).toBe("owner");
});

it("owner with adminMode=true: can(write) bypasses everything", () => {
  const r = renderWith({
    ...baseEnv,
    access: "owner" as const,
    adminMode: true,
    dbAcls: { restrictedDb: { write: ["submitters"] } },
  });
  expect(r.can("write", "restrictedDb")).toBe(true);
  expect(r.access).toBe("owner");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy && pnpm vitest run tests/app/use-viewer.test.tsx`
Expected: FAIL — `isOwner` doesn't exist, `adminMode` not accepted by `renderWith`.

- [ ] **Step 3: Implement `useViewer()` changes**

In `vibes.diy/vibe/runtime/use-viewer.ts`:

```typescript
import React from "react";
import { aclAllows, type DbAcl } from "./db-acl-allows.js";
import { useVibeContext } from "./VibeContext.js";
import type { ViewerEnv } from "./vibe.js";
import { ViewerTagImpl, type ViewerTagProps } from "./use-viewer-tag.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;
type DocAccessLevel = ViewerEnv["access"];

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly isOwner: boolean;
  readonly dbAcls: Record<string, DbAcl>;
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  readonly isViewerPending: boolean;
  readonly ViewerTag: React.FC<ViewerTagProps>;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useVibeContext();
  const env = mountParams.viewerEnv;
  const isViewerPending = env === undefined;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";
  const isOwner = access === "owner";
  const adminMode = env?.adminMode;
  const dbAcls: Record<string, DbAcl> = env?.dbAcls ?? {};

  function can(action: "read" | "write" | "delete", dbName?: string): boolean {
    if (dbName !== undefined) {
      return aclAllows(dbAcls[dbName], action, access, adminMode);
    }
    if (!aclAllows(undefined, action, access, adminMode)) return false;
    for (const acl of Object.values(dbAcls)) {
      if (!aclAllows(acl, action, access, adminMode)) return false;
    }
    return true;
  }

  const ViewerTag: React.FC<ViewerTagProps> = React.useCallback(
    (props: ViewerTagProps) => React.createElement(ViewerTagImpl, { ...props, _viewer: viewer }),
    [viewer]
  );

  return { viewer, access, isOwner, dbAcls, can, isViewerPending, ViewerTag };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy && pnpm vitest run tests/app/use-viewer.test.tsx`
Expected: PASS

- [ ] **Step 5: Check existing test `can(write)` with owner — behavior change**

The existing test at line 61 does:
```typescript
const r = renderWith({ viewer: ..., access: "owner" as const });
expect(r.can("write")).toBe(true);
```
Owner-as-editor with no `adminMode` → `canWrite("editor")` → `true`. This still passes.

The existing test at line 50 uses `access: "viewer"` — unchanged.

Run: `cd vibes.diy && pnpm vitest run tests/app/use-viewer.test.tsx`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/use-viewer.ts vibes.diy/tests/app/use-viewer.test.tsx
git commit -m "feat: useViewer() threads adminMode through can(), adds isOwner (#2166)"
```

---

### Task 4: Server-side ACL — add `adminMode` to `db-acl-resolver.ts` and `access-helpers.ts`

**Files:**
- Modify: `vibes.diy/api/svc/public/db-acl-resolver.ts`
- Modify: `vibes.diy/api/svc/public/access-helpers.ts`

- [ ] **Step 1: Add `adminMode` to `access-helpers.ts`**

In `vibes.diy/api/svc/public/access-helpers.ts`, update `canRead` and `canWrite`:

```typescript
export const canRead = (level: DocAccessLevel, adminMode?: boolean) => {
  const eff = level === "owner" && !adminMode ? "editor" : level;
  return eff === "owner" || eff === "editor" || eff === "viewer";
};
export const canWrite = (level: DocAccessLevel, adminMode?: boolean) => {
  const eff = level === "owner" && !adminMode ? "editor" : level;
  return eff === "owner" || eff === "editor" || eff === "submitter";
};
```

- [ ] **Step 2: Add `adminMode` to `db-acl-resolver.ts`**

In `vibes.diy/api/svc/public/db-acl-resolver.ts`, update `inGroup` and `aclAllows`:

```typescript
export function inGroup(level: DocAccessLevel, group: DbAclSubject, adminMode?: boolean): boolean {
  const eff = level === "owner" && !adminMode ? "editor" : level;
  if (eff === "owner") return true;
  switch (group) {
    case "members":
      return eff === "editor" || eff === "viewer" || eff === "submitter";
    case "editors":
      return eff === "editor";
    case "submitters":
      return eff === "submitter";
    case "readers":
      return eff === "editor" || eff === "viewer";
  }
}

export function aclAllows(acl: DbAcl | undefined, cap: "read" | "write" | "delete", access: DocAccessLevel, adminMode?: boolean): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access, adminMode) : canWrite(access, adminMode);
  }
  return subjects.some((g) => inGroup(access, g, adminMode));
}
```

Also update the comment at the top of `inGroup` to remove the "Owner is implicitly in every group" wording — it's now conditional on adminMode.

- [ ] **Step 3: Run type check to find callers that need updating**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`

The new param is optional, so existing callers should compile. But verify that no callers need updating for correctness (they'll default to `adminMode=undefined` which means owner-as-editor).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/public/db-acl-resolver.ts vibes.diy/api/svc/public/access-helpers.ts
git commit -m "feat: server-side ACL checks respect adminMode (#2166)"
```

---

### Task 5: Server-side `whoAmI` — accept and return `adminMode`

**Files:**
- Modify: `vibes.diy/api/svc/public/who-am-i.ts`
- Modify: `vibes.diy/api/svc/intern/render-vibe.ts`

- [ ] **Step 1: Add `adminMode` to `ResolveWhoAmIArgs` and response**

In `vibes.diy/api/svc/public/who-am-i.ts`, update the args interface:

```typescript
export interface ResolveWhoAmIArgs {
  auth: VerifiedResult | undefined;
  appSlug: string;
  ownerUserSlug: string;
  apiBaseUrl: string;
  adminMode?: boolean;
}
```

Update `ResolvedWhoAmI`:

```typescript
export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  adminMode?: boolean;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> | undefined;
}
```

- [ ] **Step 2: Thread `adminMode` through `resolveWhoAmI`**

In the `resolveWhoAmI` function, after computing `access`, set `adminMode` in the result. Only the owner gets admin mode; for everyone else it's always `false`:

```typescript
const effectiveAdminMode = access === "owner" ? (args.adminMode ?? false) : false;
```

Include `adminMode: effectiveAdminMode` in all `Result.Ok(...)` return values (there are multiple return paths in this function — update each one).

- [ ] **Step 3: Thread `adminMode` through the evento handler response**

In the `whoAmIEvento` handler, include `adminMode` in the sent response:

```typescript
await ctx.send.send(ctx, {
  type: "vibe.res.whoAmI",
  tid: req.tid,
  viewer: r.viewer,
  access: r.access,
  ...(r.adminMode ? { adminMode: r.adminMode } : {}),
  ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
  ...(r.grants !== undefined ? { grants: r.grants } : {}),
} satisfies ResVibeWhoAmI);
```

- [ ] **Step 4: Update `buildViewerEnvForRender` in render-vibe.ts**

In `vibes.diy/api/svc/intern/render-vibe.ts`, update the function to pass `adminMode` through:

```typescript
async function buildViewerEnvForRender(vctx: VibesApiSQLCtx, args: { appSlug: string; ownerUserSlug: string; apiBaseUrl: string }) {
  const r = await resolveWhoAmI(vctx, { auth: undefined, ...args });
  if (!r.isOk()) return undefined;
  const { viewer, access, adminMode, dbAcls, grants } = r.Ok();
  return { viewer, access, ...(adminMode ? { adminMode } : {}), ...(dbAcls ? { dbAcls } : {}), ...(grants ? { grants } : {}) };
}
```

- [ ] **Step 5: Update `bootstrapViewer` in register-dependencies.ts to pass through adminMode**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, around line 557, update `bootstrapViewer` to include `adminMode` in the dispatched event:

```typescript
export async function bootstrapViewer(api: VibeSandboxApi): Promise<void> {
  const res = await api.whoAmI();
  if (res.isErr()) return;
  const r = res.Ok();
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: r.viewer,
        access: r.access,
        ...(r.adminMode ? { adminMode: r.adminMode } : {}),
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants ? { grants: r.grants } : {}),
      },
    })
  );
}
```

- [ ] **Step 6: Run type check**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/vibe/runtime/register-dependencies.ts
git commit -m "feat: whoAmI carries adminMode through to ViewerEnv (#2166)"
```

---

### Task 6: Server-side `app-documents.ts` — thread `adminMode`, skip access fn when admin

**Files:**
- Modify: `vibes.diy/api/svc/public/app-documents.ts`

This is the critical server-side enforcement task. Two changes:

1. Pass `adminMode` to `aclAllows()` and `canRead()` calls so owner-as-editor ACLs apply
2. Skip access function invocation when owner + adminMode=true

- [ ] **Step 1: Add `adminMode` to document request types**

In `vibes.diy/api/types/app-documents.ts`, add `"adminMode?": "boolean"` to each request schema: `reqPutDoc`, `reqGetDoc`, `reqListDocs`, `reqSubscribeDocs`, `reqDeleteDoc`. Example for `reqPutDoc`:

```typescript
export const reqPutDoc = type({
  type: "'vibes.diy.req-put-doc'",
  auth: dashAuthType,
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
  doc: "Record<string, unknown>",
  "docId?": "string",
  "adminMode?": "boolean",
});
```

Repeat the same `"adminMode?": "boolean"` addition for all request types in that file. The field is optional so existing callers are unaffected. The server validates the flag against actual ownership (`access === "owner"`) before honoring it.

- [ ] **Step 2: Thread `adminMode` through write-path ACL checks**

In the putDoc handler (around line 163), update the `aclAllows` call:

```typescript
// Before:
if (!aclAllows(acl, "write", access)) {

// After:
if (!aclAllows(acl, "write", access, req.adminMode)) {
```

- [ ] **Step 3: Skip access function when owner + adminMode=true**

In the putDoc handler (around line 204), wrap the access function gate:

```typescript
// Before:
if (afbRow?.accessFnCid && vctx.invokeAccessFn) {
  // ... invoke access function ...
}

// After:
const skipAccessFn = access === "owner" && req.adminMode === true;
if (afbRow?.accessFnCid && vctx.invokeAccessFn && !skipAccessFn) {
  // ... invoke access function ...
}
```

- [ ] **Step 4: Thread `adminMode` through read-path ACL checks**

Find all `canRead(access)` and `aclAllows(acl, "read", access)` calls in app-documents.ts and add the `adminMode` parameter. There are read handlers for getDoc, listDocs, subscribeDocs — each has an ACL gate.

The pattern for each:
```typescript
// Before:
if (canRead(access)) return true;
// After:
if (canRead(access, adminMode)) return true;
```

And:
```typescript
// Before:
if (acl?.read !== undefined) return aclAllows(acl, "read", access);
// After:
if (acl?.read !== undefined) return aclAllows(acl, "read", access, adminMode);
```

- [ ] **Step 5: Skip access function for read-path when owner + adminMode=true**

Same pattern as the write path — when the owner is in admin mode, skip channel-filtering logic that uses access function outputs.

- [ ] **Step 6: Run type check**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`
Expected: No errors (or only errors related to request type changes needed in the next step).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/types/app-documents.ts vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat: app-documents respects adminMode for ACL and access fn gating (#2166)"
```

---

### Task 7: Align `makeHelpers()` with `AccessFnDO`

**Files:**
- Modify: `vibes.diy/api/svc/public/access-function.ts:41-58`
- Test: `vibes.diy/api/tests/access-function.test.ts`

- [ ] **Step 1: Write failing tests for grant-aware makeHelpers**

Replace the existing `makeHelpers` tests in `vibes.diy/api/tests/access-function.test.ts`:

```typescript
describe("makeHelpers", () => {
  const user: UserContext = { userHandle: "alice" };

  it("requireAccess throws when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireAccess("some-channel")).toThrow("not in channel");
  });

  it("requireRole throws when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireRole("admin")).toThrow("not in role");
  });

  it("requireAccess throws when user has no access to channel", () => {
    const ctx = makeHelpers(user, {
      members: {},
      roleGrants: {},
      userGrants: {},
    });
    expect(() => ctx.requireAccess("secret-channel")).toThrow("not in channel");
  });

  it("requireAccess passes when user has direct channel grant", () => {
    const ctx = makeHelpers(user, {
      members: {},
      roleGrants: {},
      userGrants: { alice: ["secret-channel"] },
    });
    expect(() => ctx.requireAccess("secret-channel")).not.toThrow();
  });

  it("requireAccess passes when user has channel via role", () => {
    const ctx = makeHelpers(user, {
      members: { admin: ["alice"] },
      roleGrants: { admin: ["admin-channel"] },
      userGrants: {},
    });
    expect(() => ctx.requireAccess("admin-channel")).not.toThrow();
  });

  it("requireRole throws when user does not have the role", () => {
    const ctx = makeHelpers(user, {
      members: { editor: ["bob"] },
      roleGrants: {},
      userGrants: {},
    });
    expect(() => ctx.requireRole("editor")).toThrow("not in role");
  });

  it("requireRole passes when user has the role", () => {
    const ctx = makeHelpers(user, {
      members: { admin: ["alice"] },
      roleGrants: {},
      userGrants: {},
    });
    expect(() => ctx.requireRole("admin")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy && pnpm vitest run api/tests/access-function.test.ts`
Expected: FAIL — `makeHelpers` doesn't accept a second argument.

- [ ] **Step 3: Implement grant-aware `makeHelpers`**

In `vibes.diy/api/svc/public/access-function.ts`, replace the `makeHelpers` function:

```typescript
interface GrantState {
  members: Record<string, string[]>;
  roleGrants: Record<string, string[]>;
  userGrants: Record<string, string[]>;
}

export function makeHelpers(user: UserContext | null, grantState?: GrantState): Helpers {
  const gs: GrantState = grantState ?? { members: {}, roleGrants: {}, userGrants: {} };

  function resolveChannels(userSlug: string): Set<string> {
    const channels = new Set<string>();
    const direct = gs.userGrants[userSlug];
    if (direct) for (const ch of direct) channels.add(ch);
    for (const [role, members] of Object.entries(gs.members)) {
      if (members.includes(userSlug)) {
        const roleChannels = gs.roleGrants[role];
        if (roleChannels) for (const ch of roleChannels) channels.add(ch);
      }
    }
    return channels;
  }

  return {
    requireAccess(channelId: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
      const channels = resolveChannels(user.userHandle);
      if (!channels.has(channelId)) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
    },
    requireRole(roleName: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
      const roleMembers = gs.members[roleName];
      if (!roleMembers?.includes(user.userHandle)) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy && pnpm vitest run api/tests/access-function.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-function.ts vibes.diy/api/tests/access-function.test.ts
git commit -m "feat: makeHelpers() enforces grants like AccessFnDO (#2166)"
```

---

### Task 8: `/vibe/` route UI — admin toggle

**Files:**
- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Add `adminMode` state with localStorage persistence**

Near the existing `isOwner` state (around line 160), add:

```typescript
const adminStorageKey = `adminMode:${ownerHandle}/${appSlug}`;
const [adminMode, setAdminMode] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(adminStorageKey) === "true";
});

const toggleAdmin = useCallback(() => {
  setAdminMode((prev) => {
    const next = !prev;
    localStorage.setItem(adminStorageKey, String(next));
    return next;
  });
}, [adminStorageKey]);
```

- [ ] **Step 2: Gate owner-only chrome on `adminMode`**

Update the pending requests badge and share management to only show when admin mode is on. In the `ExpandedVibesPill` props (around line 572):

```typescript
communityBadgeCount={isOwner && adminMode ? pendingCount : 0}
hasUnpublishedChanges={isOwner && adminMode && shareModal.hasUnpublishedChanges}
```

- [ ] **Step 3: Push `adminMode` into the iframe via `pushViewerChanged`**

When `adminMode` changes, re-push viewerChanged to the iframe so `can()` re-evaluates. Add a `useEffect` that pushes the updated viewer env when `adminMode` or `isOwner` changes:

```typescript
useEffect(() => {
  if (!srvVibeSandbox || !isOwner) return;
  // Re-push viewer with updated adminMode so the iframe's can() re-evaluates.
  // The viewer identity and access level stay the same — only adminMode changes.
  srvVibeSandbox.pushViewerChanged({
    type: "vibe.evt.viewerChanged",
    viewer: null, // bootstrapViewer fills this in
    access: "owner",
    adminMode,
  });
}, [adminMode, isOwner, srvVibeSandbox]);
```

- [ ] **Step 4: Add toggle UI — owner-only, in the pill area**

Add a simple toggle below the ExpandedVibesPill, inside the portal, visible only when `isOwner`:

```tsx
{isOwner && (
  <button
    onClick={toggleAdmin}
    className="mt-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
    style={{
      backgroundColor: adminMode ? "var(--vibes-accent)" : "var(--vibes-bg-secondary)",
      color: adminMode ? "var(--vibes-bg-primary)" : "var(--vibes-text-secondary)",
    }}
  >
    <span>{adminMode ? "Admin" : "User"}</span>
  </button>
)}
```

Place this inside the existing `<div className="fixed bottom-4 right-4 z-50">` portal, after the `<ShareModal>`.

- [ ] **Step 5: Run dev server and verify toggle works**

Run: `cd vibes.diy && pnpm dev`
Navigate to a vibe you own. Verify:
- Toggle visible in bottom-right pill area
- Toggle defaults to off ("User" label)
- Clicking toggles to "Admin"
- Refreshing preserves the state via localStorage
- Non-owners don't see the toggle

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx
git commit -m "feat: admin toggle in /vibe/ route chrome (#2166)"
```

---

### Task 9: Integration — run full check

- [ ] **Step 1: Run pnpm fast-check**

Run: `cd vibes.diy && pnpm fast-check`
Expected: All checks pass — format, build, test, lint.

- [ ] **Step 2: Fix any failures**

Address any test failures or type errors from the `adminMode` changes. The most likely issues:
- Existing tests that assert owner bypass without passing `adminMode=true`
- Server-side callers of `canRead`/`canWrite` that need `adminMode` threaded

- [ ] **Step 3: Run prettier**

Run: `npx prettier --write vibes.diy/vibe/runtime/db-acl-allows.ts vibes.diy/vibe/runtime/use-viewer.ts vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/types/index.ts vibes.diy/api/svc/public/access-function.ts vibes.diy/api/svc/public/access-helpers.ts vibes.diy/api/svc/public/db-acl-resolver.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx vibes.diy/api/tests/db-acl-allows.test.ts vibes.diy/api/tests/access-function.test.ts vibes.diy/tests/app/use-viewer.test.tsx`

- [ ] **Step 4: Commit formatting fixes if any**

```bash
git add -u && git commit -m "style: prettier formatting"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: owner admin toggle — default to editor, opt-in bypass (#2166)" --body "$(cat <<'EOF'
## Summary

- Owner identity (`useViewer().access === "owner"`) is unchanged — App.jsx always knows who the owner is
- ACL checks (`can()`, `aclAllows()`, `inGroup()`) now evaluate owner as editor by default
- Admin toggle in `/vibe/` route chrome (owner-only) re-enables full bypass
- Admin mode is invisible to vibe code — not exposed on `useViewer()`, not in access functions
- `makeHelpers()` aligned with `AccessFnDO` — now checks real grant state instead of pass-all stubs
- When admin mode is on, access functions are not executed for reads or writes

Closes #2166

## Test plan

- [ ] Owner with adminMode off: `can("write", restrictedDb)` returns false for submitters-only DBs
- [ ] Owner with adminMode on: `can()` bypasses everything
- [ ] `useViewer().access === "owner"` always true regardless of toggle
- [ ] Admin toggle visible only to owner, persists in localStorage
- [ ] Non-owners unaffected by any changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
