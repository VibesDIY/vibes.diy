# Owner Admin Toggle — Design Spec

## Problem

The owner always bypasses every ACL and access function check. `inGroup()` returns `true` immediately when `level === "owner"` ([db-acl-allows.ts:17](../../vibes.diy/vibe/runtime/db-acl-allows.ts)). `canRead("owner")` and `canWrite("owner")` both short-circuit to `true` ([db-acl-allows.ts:12-14](../../vibes.diy/vibe/runtime/db-acl-allows.ts)). The server returns `"owner"` from `checkDocAccess()` ([access-helpers.ts:26](../../vibes.diy/api/svc/public/access-helpers.ts)) and all downstream checks use that level.

This means the owner never experiences their own vibe's permissions. They can't test ACLs, can't participate as a normal user, and can't verify that their access functions work correctly.

## Design

### Core Principle: Identity vs Permissions

**Identity stays `"owner"` always.** `useViewer().access` returns `"owner"` so App.jsx always knows who the owner is and can show owner-specific UI (create channels, manage settings).

**Permissions default to editor.** When the owner is not in admin mode, all ACL checks (`can()`, `aclAllows()`, `inGroup()`) evaluate the owner as `"editor"`. Access functions run normally — the owner's writes go through the same `AccessFnDO` enforcement as everyone else.

### Admin Mode is Invisible to Vibe Code

Admin mode is a **platform-level** concern. The vibe sandbox (App.jsx, access functions) never sees it:

- `useViewer()` does not expose `adminMode` — the vibe just sees `access: "owner"` and the results of `can()` checks
- Access functions are not told whether the owner is in admin mode — they run the same code path regardless
- The LLM / vibe prompt system does not mention admin mode — it's not a concept vibe authors need to know about
- The admin toggle lives in the `/vibe/` route chrome (outside the iframe), not inside the vibe itself

From the vibe's perspective, the owner is always the owner. The platform decides how to evaluate their permissions.

### Admin Mode

A boolean toggle, off by default, stored in `ViewerEnv` and propagated through the iframe bridge.

- **Admin OFF (default):** Owner sees what an editor sees. Writes go through access functions. The owner participates like a normal user.
- **Admin ON:** Full bypass. The access function is **not executed** for reads or writes — the owner sees all data and can write anything. The current "owner" behavior.

The toggle appears in the vibe menu on the `/vibe/` route, visible only to the owner.

## Changes by Layer

### 1. ViewerEnv — add `adminMode` (internal)

In [vibe.ts:21-27](../../vibes.diy/vibe/runtime/vibe.ts):

```typescript
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "adminMode?": "boolean",           // NEW — platform-internal, default false
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

This field is in the wire format (ViewerEnv) so the runtime can read it internally. It is consumed by `useViewer().can()` under the hood but **not** exposed on the `UseViewerResult` type. Vibe authors cannot access it, and it should not appear in vibe documentation or LLM prompts.

Note: `adminMode` travels through the iframe bridge because `useViewer()` needs it to evaluate `can()` correctly. This is an implementation detail, not a public API surface.

### 2. db-acl-allows.ts — owner bypass checks adminMode

In [db-acl-allows.ts](../../vibes.diy/vibe/runtime/db-acl-allows.ts):

`inGroup()`, `canRead()`, `canWrite()` gain an `adminMode` parameter. When `level === "owner"` and `adminMode` is false (or absent), evaluate as `"editor"` instead of bypassing.

```typescript
export function inGroup(level: DocAccessLevel, group: DbAclSubject, adminMode?: boolean): boolean {
  const effective = level === "owner" && !adminMode ? "editor" : level;
  if (effective === "owner") return true;
  switch (group) {
    case "members":
      return effective === "editor" || effective === "viewer" || effective === "submitter";
    // ... rest unchanged
  }
}
```

Same pattern for `canRead()` and `canWrite()` — when owner + not admin, delegate to editor logic.

### 3. useViewer() — thread adminMode internally, don't expose it

In [use-viewer.ts](../../vibes.diy/vibe/runtime/use-viewer.ts):

- Read `adminMode` from `env` internally
- `access` still returns `"owner"` (identity unchanged)
- `can()` passes `adminMode` through to `aclAllows()` internally — vibe code just calls `can("read")` and gets the right answer
- `adminMode` is **not** exposed on the return type — vibe code cannot see or depend on it

```typescript
export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;     // still "owner" for the owner
  readonly isOwner: boolean;           // NEW — convenience for access === "owner"
  readonly can: (action: "read" | "write" | "delete", dbName?: string) => boolean;
  // ... rest unchanged (no adminMode field)
}
```

The `can()` function internally reads `adminMode` from the `ViewerEnv` and passes it to `aclAllows()`. The vibe author just sees that `can("write", "private-db")` returns `false` when their ACLs restrict editors — they don't know why.

### 4. Server-side: whoAmI carries adminMode

In [who-am-i.ts](../../vibes.diy/api/svc/public/who-am-i.ts):

`resolveWhoAmI()` accepts an `adminMode` parameter (from a query param on the whoAmI request, or from a cookie). When the real owner has `adminMode=false`:

- `access` in the response is still `"owner"` (identity)
- `ViewerEnv.adminMode` is `false`
- Server-side document sync respects the flag: `canRead()` and `canWrite()` in `app-documents.ts` receive `adminMode` alongside the access level, so owner + adminMode=false evaluates as editor for read/write gating

When `adminMode=true` and the user is the owner:

- Same as today: full bypass

Non-owners: `adminMode` is ignored, always `false` in the response.

### 5. Server-side: admin mode skips access function execution

In [app-documents.ts](../../vibes.diy/api/svc/public/app-documents.ts):

When the owner is in admin mode (`adminMode=true`), the server does not invoke the access function (`AccessFnDO`) for reads or writes. Documents are read/written without access function evaluation — no channel filtering, no `requireRole()`/`requireAccess()` checks, no `{ forbidden }` rejections.

When admin mode is off, the owner's reads and writes go through the access function like any other user.

### 6. /vibe/ route UI — admin toggle

In [vibe.$ownerHandle.$appSlug.tsx](../../vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx):

- Add `adminMode` state (default `false`), persisted to `localStorage` per vibe (key: `adminMode:${ownerHandle}/${appSlug}`)
- Toggle visible only when `isOwner` is true, in the vibe menu area
- When toggled, re-issue the whoAmI call with the new `adminMode` value so the iframe gets the updated `ViewerEnv`
- Owner-only chrome (pending requests badge, share management button) visible only when `adminMode` is true

### 7. makeHelpers() — align with AccessFnDO

In [access-function.ts:41-58](../../vibes.diy/api/svc/public/access-function.ts):

The Phase 3 stub comments are misleading — `AccessFnDO` ([access-fn.ts:104-126](../../vibes.diy/pkg/workers/access-fn.ts)) already enforces `requireRole()` and `requireAccess()` against real grant state. `makeHelpers()` is only used in tests.

Update `makeHelpers()` to accept grant state and enforce the same way the DO does, so tests are accurate. This closes the test-helper gap from #2166.

## What Doesn't Change

- `DocAccessLevel` type: still `'owner' | 'editor' | 'viewer' | 'submitter' | 'none'`
- `checkDocAccess()` return value: still `"owner"` for the owner
- `useViewer().access`: still `"owner"` for the owner
- `AccessFnDO` enforcement: already checks grant state, no owner bypass
- Grant tables: owner still not in grant tables (identity-based, not grant-based)

## Test Plan

- Owner with adminMode=false: `can("read")` and `can("write")` evaluate as editor against dbAcls
- Owner with adminMode=true: `can()` bypasses everything (current behavior)
- Owner with adminMode=false: writes go through access function (DO enforces grant state)
- Owner with adminMode=true: access function is not executed for reads or writes
- `useViewer().access === "owner"` always true for the owner regardless of adminMode
- `useViewer().isOwner` always true for the owner
- Vibe code cannot read `adminMode` from `useViewer()` — field is not on the return type
- Admin toggle visible only to owner in `/vibe/` route chrome (outside iframe)
- Admin toggle persists per-vibe in localStorage
- Owner-only chrome (pending requests, share) hidden when adminMode=false
