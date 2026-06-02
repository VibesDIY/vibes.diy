# Owner Admin Toggle — Design Spec

## Problem

The owner always bypasses every ACL and access function check. `inGroup()` returns `true` immediately when `level === "owner"` ([db-acl-allows.ts:17](../../vibes.diy/vibe/runtime/db-acl-allows.ts)). `canRead("owner")` and `canWrite("owner")` both short-circuit to `true` ([db-acl-allows.ts:12-14](../../vibes.diy/vibe/runtime/db-acl-allows.ts)). The server returns `"owner"` from `checkDocAccess()` ([access-helpers.ts:26](../../vibes.diy/api/svc/public/access-helpers.ts)) and all downstream checks use that level.

This means the owner never experiences their own vibe's permissions. They can't test ACLs, can't participate as a normal user, and can't verify that their access functions work correctly.

## Design

### Core Principle: Effective Access Level + Identity Flag

**`access` returns the effective permission level.** When admin mode is off, the owner gets `access: "editor"` — the same level any granted editor would get. ACL checks (`can()`, `aclAllows()`, `inGroup()`) work against this level with no special-casing. There is no split brain between `access` and `can()`.

**`isOwner` is a separate identity flag.** `useViewer().isOwner` tells App.jsx "this user owns this vibe" for UI concerns — showing settings, the admin toggle, owner-specific features. This is identity, not permissions.

**When admin mode is on,** `access` returns `"owner"` and everything bypasses as today.

This means:
- A vibe author who checks `access === "editor"` and `can("write")` gets consistent answers
- Owner-specific UI uses `isOwner`, not `access === "owner"`
- No `adminMode` threading through ACL helpers — the server makes the decision once, upstream

### Admin Mode is Invisible to Vibe Code

Admin mode is a **platform-level** concern. The vibe sandbox (App.jsx, access functions) never sees it:

- `useViewer()` does not expose `adminMode` — the vibe sees `access` (effective level) and `isOwner` (identity)
- Access functions receive `user.isOwner` so vibe authors can write owner-specific policy, but they don't know about admin mode
- The LLM / vibe prompt system does not mention admin mode — it's not a concept vibe authors need to know about
- The admin toggle lives in the `/vibe/` route chrome (outside the iframe), not inside the vibe itself

### Three Layers of Owner Policy

1. **Platform (admin toggle):** Full bypass. Access functions not executed. `access: "owner"`. The owner needs this for debugging, seeing all data, emergency fixes.

2. **Vibe author (access function with `user.isOwner`):** The vibe author decides what the owner can do when participating normally. E.g., "owners can always create channels" or "owners can delete any post." This runs through the normal access function path.

3. **Default (editor):** When admin is off and the access function doesn't special-case the owner, they're just an editor — subject to the same ACLs as any other editor.

### Admin Mode

A boolean toggle, off by default. The server resolves it at `whoAmI` time and returns the appropriate effective access level.

- **Admin OFF (default):** `checkDocAccess()` returns `"editor"` for the owner. Writes go through access functions with `user.isOwner = true`. The owner participates like a normal user but the access function knows who they are.
- **Admin ON:** `checkDocAccess()` returns `"owner"`. Access functions are **not executed** for reads or writes. The current behavior.

The toggle appears in the vibe menu on the `/vibe/` route, visible only to the owner.

## Changes by Layer

### 1. `checkDocAccess()` — return effective level

In [access-helpers.ts:26](../../vibes.diy/api/svc/public/access-helpers.ts):

When the userId matches the ownerHandle binding:
- If `adminMode` is true: return `"owner"` (full bypass, current behavior)
- If `adminMode` is false (default): return `"editor"`

```typescript
export async function checkDocAccess(
  vctx: VibesApiSQLCtx,
  userId: string,
  appSlug: string,
  ownerHandle: string,
  adminMode?: boolean
): Promise<{ access: DocAccessLevel; isOwner: boolean }> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.handleBinding.userId })
    .from(vctx.sql.tables.handleBinding)
    .where(eq(vctx.sql.tables.handleBinding.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);

  if (binding?.userId === userId) {
    return { access: adminMode ? "owner" : "editor", isOwner: true };
  }

  // ... existing grant/invite/request checks ...
  return { access: resolvedRole, isOwner: false };
}
```

All callers of `checkDocAccess()` now receive `{ access, isOwner }` instead of a bare `DocAccessLevel`.

### 2. ViewerEnv — add `isOwner`

In [vibe.ts:21-27](../../vibes.diy/vibe/runtime/vibe.ts):

```typescript
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "isOwner?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

No `adminMode` in ViewerEnv — the server already resolved it into the effective `access` level.

### 3. useViewer() — expose `isOwner`

In [use-viewer.ts](../../vibes.diy/vibe/runtime/use-viewer.ts):

```typescript
export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;     // effective level: "editor" when admin off, "owner" when admin on
  readonly isOwner: boolean;           // true when the viewer owns this vibe, regardless of admin mode
  readonly dbAcls: Record<string, DbAcl>;
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  readonly isViewerPending: boolean;
  readonly ViewerTag: React.FC<ViewerTagProps>;
}
```

`can()` works against `access` with no special logic — it's just `aclAllows(acl, action, access)` as today. No `adminMode` parameter needed.

### 4. db-acl-allows.ts — no changes needed

The ACL helpers (`canRead`, `canWrite`, `inGroup`, `aclAllows`) remain unchanged. They receive `"editor"` when admin is off and `"owner"` when admin is on. The decision is made upstream in `checkDocAccess()`.

### 5. UserContext — add `isOwner` for access functions

In [api/types/access-function.ts](../../vibes.diy/api/types/access-function.ts):

```typescript
export interface UserContext {
  userHandle: string;
  displayName?: string;
  isOwner?: boolean;
}
```

The server sets `isOwner: true` when building the `userContext` for access function invocation. This lets vibe authors write owner-specific policy:

```js
export default function(doc, oldDoc, user, ctx) {
  if (user?.isOwner) {
    return { channels: [doc.channel] };
  }
  ctx.requireRole("moderator");
  return { channels: [doc.channel] };
}
```

The `AccessFnDO` already passes the full `user` object into the QuickJS sandbox, so `isOwner` flows through automatically.

### 6. Server-side: whoAmI resolves effective level

In [who-am-i.ts](../../vibes.diy/api/svc/public/who-am-i.ts):

`resolveWhoAmI()` accepts `adminMode` and passes it to `checkDocAccess()`. The response includes:
- `access`: the effective level (`"editor"` or `"owner"`)
- `isOwner`: true if the viewer is the vibe owner

```typescript
export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  isOwner: boolean;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> | undefined;
}
```

The bridge types (`ResVibeWhoAmI`, `EvtVibeViewerChanged`) also gain `"isOwner?"`.

### 7. Server-side: admin mode skips access function execution

In [app-documents.ts](../../vibes.diy/api/svc/public/app-documents.ts):

When `access === "owner"` (which only happens when admin mode is on), the server does not invoke the access function. This is the same check as today — no new logic needed, because `checkDocAccess()` only returns `"owner"` when admin mode is on.

When admin mode is off, the owner's `access` is `"editor"` and the normal access function path runs. The `userContext` passed to the access function includes `isOwner: true` so the vibe author's code can branch on it.

### 8. Server-side: `app-documents.ts` — set `isOwner` on userContext

When building the `userContext` for access function invocation, set `isOwner` based on the `isOwner` flag from `checkDocAccess()`:

```typescript
const userContext = writerRow?.handle
  ? { userHandle: writerRow.handle, isOwner: docAccessResult.isOwner }
  : null;
```

### 9. /vibe/ route UI — admin toggle

In [vibe.$ownerHandle.$appSlug.tsx](../../vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx):

- Add `adminMode` state (default `false`), persisted to `localStorage` per vibe
- Toggle visible only when `isOwner` is true, in the vibe menu area
- When toggled, re-issue a full `whoAmI` call with the new `adminMode` value — this returns a complete `ViewerEnv` payload (viewer, access, isOwner, dbAcls, grants), not a partial push
- Push the full result via `pushViewerChanged` so the iframe gets consistent state
- Owner-only chrome (pending requests badge, share management) visible only when `adminMode` is true

### 10. makeHelpers() — align with AccessFnDO

Update `makeHelpers()` to accept grant state and enforce the same way the DO does.

### 11. Bridge types — add `isOwner`, `adminMode` on whoAmI request

- `ReqVibeWhoAmI` gains `"adminMode?"` so the iframe can request admin mode
- `ResVibeWhoAmI` and `EvtVibeViewerChanged` gain `"isOwner?"` 
- Runtime document request types (`reqPutDoc`, `reqGetDoc`, etc.) do NOT need `adminMode` — the server already knows the effective access level from the connection/session state

### 12. End-to-end admin toggle flow

```
Toggle ON in /vibe/ chrome
  → whoAmI({ adminMode: true }) via bridge
  → server: checkDocAccess() returns { access: "owner", isOwner: true }
  → response: { access: "owner", isOwner: true, dbAcls, grants }
  → pushViewerChanged with full payload
  → iframe: useViewer().access === "owner", can() bypasses, isOwner === true
  → document ops: access === "owner" → skip access function (current behavior)

Toggle OFF in /vibe/ chrome
  → whoAmI({ adminMode: false }) via bridge
  → server: checkDocAccess() returns { access: "editor", isOwner: true }
  → response: { access: "editor", isOwner: true, dbAcls, grants }
  → pushViewerChanged with full payload
  → iframe: useViewer().access === "editor", can() evaluates as editor, isOwner === true
  → document ops: access === "editor" → access function runs with user.isOwner = true
```

## What Doesn't Change

- `DocAccessLevel` type: still `'owner' | 'editor' | 'viewer' | 'submitter' | 'none'`
- `db-acl-allows.ts` functions: no signature changes, no `adminMode` parameter
- `AccessFnDO` enforcement: already checks grant state, no owner bypass
- Grant tables: owner still not in grant tables (identity-based, not grant-based)

## What Changes from Previous Revision

- `access` now returns the **effective** level, not always `"owner"` — eliminates split brain between `access` and `can()`
- `isOwner` is a separate boolean flag on `useViewer()` and `ViewerEnv`
- No `adminMode` threading through ACL helpers — decision made once in `checkDocAccess()`
- Access functions get `user.isOwner` so vibe authors can write owner-specific policy
- Full `whoAmI` re-fetch on toggle instead of partial `viewerChanged` push (addresses Charlie's review feedback)
- Document request types don't need `adminMode` — server resolves it upstream

## Test Plan

- Owner with admin off: `access === "editor"`, `isOwner === true`, `can()` evaluates as editor
- Owner with admin on: `access === "owner"`, `isOwner === true`, `can()` bypasses everything
- Owner with admin off: writes go through access function with `user.isOwner === true`
- Owner with admin on: access function not executed for reads or writes
- Non-owner: `isOwner === false`, `access` is their granted role, `user.isOwner` is false/undefined in access fn
- Toggle ON→OFF: full whoAmI re-fetch, iframe gets consistent ViewerEnv with editor access
- Toggle OFF→ON: full whoAmI re-fetch, iframe gets consistent ViewerEnv with owner access
- `accessFnOutputs` policy: admin-on writes skip access fn, so no outputs stored — subsequent admin-off reads correctly see only what access fn outputs exist
- Admin toggle visible only to owner in `/vibe/` route chrome (outside iframe)
- Admin toggle persists per-vibe in localStorage
- Owner-only chrome (pending requests, share) hidden when admin off
