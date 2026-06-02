# Owner Admin Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate owner identity from permissions — `access` returns effective level (`"editor"` when admin off, `"owner"` when admin on), with a separate `isOwner` boolean for identity. Admin toggle in `/vibe/` route chrome.

**Architecture:** `checkDocAccess()` is the single decision point — it returns `{ access, isOwner }` based on `adminMode`. No `adminMode` threading through ACL helpers. Full `whoAmI` re-fetch on toggle. `user.isOwner` available in access functions.

**Tech Stack:** TypeScript, arktype schemas, React, vitest

**Spec:** [docs/superpowers/specs/2026-06-02-owner-admin-toggle-design.md](../specs/2026-06-02-owner-admin-toggle-design.md)

**Issue:** [#2166](https://github.com/VibesDIY/vibes.diy/issues/2166)

---

## File Map

| File                                                      | Action | Responsibility                                                                             |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `vibes.diy/api/svc/public/access-helpers.ts`              | Modify | `checkDocAccess()` returns `{ access, isOwner }` based on `adminMode`                      |
| `vibes.diy/api/svc/public/who-am-i.ts`                    | Modify | Accept `adminMode`, pass to `checkDocAccess()`, return `isOwner`                           |
| `vibes.diy/api/svc/public/app-documents.ts`               | Modify | Destructure `{ access, isOwner }` from `checkDocAccess()`, set `isOwner` on userContext    |
| `vibes.diy/api/svc/public/files-asset.ts`                 | Modify | Destructure `{ access }` from `checkDocAccess()`                                           |
| `vibes.diy/api/svc/public/asset-upload-grant.ts`          | Modify | Destructure `{ access }` from `checkDocAccess()`                                           |
| `vibes.diy/api/svc/public/list-members.ts`                | Modify | Destructure `{ access }` from `checkDocAccess()`                                           |
| `vibes.diy/api/svc/intern/render-vibe.ts`                 | Modify | Pass `isOwner` through `buildViewerEnvForRender`                                           |
| `vibes.diy/api/types/access-function.ts`                  | Modify | Add `isOwner` to `UserContext` interface                                                   |
| `vibes.diy/vibe/types/index.ts`                           | Modify | Add `isOwner` to `ResVibeWhoAmI`, `EvtVibeViewerChanged`, `ReqVibeWhoAmI` gets `adminMode` |
| `vibes.diy/vibe/runtime/vibe.ts`                          | Modify | Add `isOwner` to `viewerEnv` schema                                                        |
| `vibes.diy/vibe/runtime/VibeContext.tsx`                  | Modify | Include `isOwner` in `viewerChanged` handler                                               |
| `vibes.diy/vibe/runtime/use-viewer.ts`                    | Modify | Expose `isOwner` from `ViewerEnv`                                                          |
| `vibes.diy/vibe/runtime/register-dependencies.ts`         | Modify | Include `isOwner` in `bootstrapViewer` event dispatch                                      |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`               | Modify | Forward `isOwner` in whoAmI handler response                                               |
| `vibes.diy/api/svc/public/access-function.ts`             | Modify | Wire `makeHelpers()` to use grant state                                                    |
| `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` | Modify | Admin toggle UI with full whoAmI re-fetch                                                  |
| `vibes.diy/api/tests/db-acl-allows.test.ts`               | Modify | No ACL changes but add tests validating owner-as-editor                                    |
| `vibes.diy/tests/app/use-viewer.test.tsx`                 | Modify | Test `isOwner` and effective access level                                                  |
| `vibes.diy/api/tests/access-function.test.ts`             | Modify | Test grant-aware `makeHelpers()`                                                           |

---

### Task 1: `checkDocAccess()` — return `{ access, isOwner }` with `adminMode`

**Files:**

- Modify: `vibes.diy/api/svc/public/access-helpers.ts`

- [ ] **Step 1: Change `checkDocAccess()` return type and add `adminMode` param**

In `vibes.diy/api/svc/public/access-helpers.ts`, change the function signature and implementation:

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

  const rInvite = await hasAccessInvite(vctx, { grantUserId: userId, appSlug, ownerHandle });
  if (rInvite.isOk()) {
    const invite = rInvite.Ok();
    if (isResHasAccessInviteAccepted(invite)) {
      return { access: invite.role, isOwner: false };
    }
  }

  const rReq = await hasAccessRequest(vctx, { foreignUserId: userId, appSlug, ownerHandle });
  if (rReq.isOk()) {
    const req = rReq.Ok();
    if (isResHasAccessRequestApproved(req)) {
      return { access: req.role, isOwner: false };
    }
  }

  return { access: "none", isOwner: false };
}
```

Also update `canRead` and `canWrite` — these stay as-is (no `adminMode` param needed, they just take the effective level).

- [ ] **Step 2: Run type check to find all callers that need updating**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -60`

Expected: Type errors at every call site that destructures a bare `DocAccessLevel` from `checkDocAccess()`. There are ~12 call sites across `app-documents.ts`, `who-am-i.ts`, `files-asset.ts`, `asset-upload-grant.ts`, `list-members.ts`.

- [ ] **Step 3: Fix all callers — destructure `{ access }` or `{ access, isOwner }`**

Each caller currently does one of:

```typescript
// Pattern A: bare assignment
const access = await checkDocAccess(vctx, userId, appSlug, ownerHandle);
// Fix →
const { access } = await checkDocAccess(vctx, userId, appSlug, ownerHandle);

// Pattern B: ternary
const access = viewerUserId ? await checkDocAccess(...) : "none";
// Fix →
const { access } = viewerUserId ? await checkDocAccess(...) : { access: "none" as DocAccessLevel, isOwner: false };
```

Files to update (with line numbers from current code):

- `app-documents.ts:154` — putDoc handler, use `{ access, isOwner }` (need isOwner for userContext)
- `app-documents.ts:521` — getDoc handler, ternary pattern
- `app-documents.ts:718` — listDocs handler, ternary pattern
- `app-documents.ts:852` — deleteDoc handler, use `{ access, isOwner }` (need isOwner for userContext)
- `app-documents.ts:937` — subscribeDocs handler, ternary pattern
- `app-documents.ts:1055` — searchDocs handler
- `who-am-i.ts:132` — ternary pattern
- `files-asset.ts:128` — ternary pattern
- `asset-upload-grant.ts:57` — bare assignment
- `list-members.ts:58` — ternary pattern

- [ ] **Step 4: Run type check again**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`
Expected: No type errors from `checkDocAccess()` callers.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-helpers.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/public/files-asset.ts vibes.diy/api/svc/public/asset-upload-grant.ts vibes.diy/api/svc/public/list-members.ts
git commit -m "feat: checkDocAccess returns { access, isOwner } with adminMode param (#2166)"
```

---

### Task 2: `UserContext` — add `isOwner`, set it in `app-documents.ts`

**Files:**

- Modify: `vibes.diy/api/types/access-function.ts:11-14`
- Modify: `vibes.diy/api/svc/public/app-documents.ts` (userContext construction sites)

- [ ] **Step 1: Add `isOwner` to `UserContext` interface**

In `vibes.diy/api/types/access-function.ts`:

```typescript
export interface UserContext {
  userHandle: string;
  displayName?: string;
  isOwner: boolean;
}
```

- [ ] **Step 2: Set `isOwner` on userContext in putDoc handler**

In `app-documents.ts`, the putDoc handler builds `userContext` around line 218:

```typescript
const userContext = writerRow?.handle ? { userHandle: writerRow.handle } : null;
```

Change to:

```typescript
const userContext = writerRow?.handle ? { userHandle: writerRow.handle, isOwner } : null;
```

Where `isOwner` comes from the `checkDocAccess()` result destructured in Task 1.

- [ ] **Step 3: Set `isOwner` on userContext in deleteDoc handler**

Same pattern in the deleteDoc handler — find where `userContext` is built and add `isOwner`.

- [ ] **Step 4: Run type check**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`
Expected: May see errors if other code constructs `UserContext` without `isOwner`. Fix any remaining sites.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/access-function.ts vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat: UserContext.isOwner available in access functions (#2166)"
```

---

### Task 3: Bridge types — add `isOwner` to responses, `adminMode` to whoAmI request

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts`

- [ ] **Step 1: Add `adminMode` to `ReqVibeWhoAmI`**

Around line 576:

```typescript
export const ReqVibeWhoAmI = type({
  type: "'vibe.req.whoAmI'",
  appSlug: "string",
  ownerHandle: "string",
  "adminMode?": "boolean",
}).and(Base);
```

- [ ] **Step 2: Add `isOwner` to `ResVibeWhoAmI`**

Around line 596:

```typescript
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "isOwner?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
}).and(Base);
```

- [ ] **Step 3: Add `isOwner` to `EvtVibeViewerChanged`**

Around line 654:

```typescript
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "isOwner?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/vibe/types/index.ts
git commit -m "feat: bridge types gain isOwner on responses, adminMode on whoAmI request (#2166)"
```

---

### Task 4: ViewerEnv + VibeContext + useViewer — add `isOwner`

**Files:**

- Modify: `vibes.diy/vibe/runtime/vibe.ts`
- Modify: `vibes.diy/vibe/runtime/VibeContext.tsx`
- Modify: `vibes.diy/vibe/runtime/use-viewer.ts`
- Test: `vibes.diy/tests/app/use-viewer.test.tsx`

- [ ] **Step 1: Add `isOwner` to `viewerEnv` schema in vibe.ts**

```typescript
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "isOwner?": "boolean",
  "dbAcls?": type({ "[string]": dbAcl }),
  "grants?": type({ "[string]": type({ channels: "string[]", publicChannels: "string[]", roles: "string[]" }) }),
});
```

- [ ] **Step 2: Include `isOwner` in VibeContext.tsx viewerChanged handler**

In `vibes.diy/vibe/runtime/VibeContext.tsx`, the `onMsg` handler at line 58 rebuilds viewerEnv from the event. Add `isOwner`:

```typescript
setViewerEnv({
  viewer: event.data.viewer,
  access: event.data.access,
  ...(event.data.isOwner !== undefined ? { isOwner: event.data.isOwner } : {}),
  ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
  ...(event.data.grants ? { grants: event.data.grants } : {}),
});
```

- [ ] **Step 3: Expose `isOwner` in useViewer()**

In `vibes.diy/vibe/runtime/use-viewer.ts`:

Add `isOwner` to the interface and the hook:

```typescript
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
  const isOwner = env?.isOwner ?? false;
  const dbAcls: Record<string, DbAcl> = env?.dbAcls ?? {};

  function can(action: "read" | "write" | "delete", dbName?: string): boolean {
    if (dbName !== undefined) {
      return aclAllows(dbAcls[dbName], action, access);
    }
    if (!aclAllows(undefined, action, access)) return false;
    for (const acl of Object.values(dbAcls)) {
      if (!aclAllows(acl, action, access)) return false;
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

Note: `can()` has NO changes — it uses `access` directly, which is the effective level. No `adminMode` parameter.

- [ ] **Step 4: Write tests**

Add to `vibes.diy/tests/app/use-viewer.test.tsx`:

```typescript
it("isOwner is true when viewerEnv.isOwner is true", () => {
  const r = renderWith({ ...baseEnv, access: "editor" as const, isOwner: true });
  expect(r.isOwner).toBe(true);
  expect(r.access).toBe("editor");
});

it("isOwner is false by default", () => {
  const r = renderWith({ ...baseEnv, access: "editor" as const });
  expect(r.isOwner).toBe(false);
});

it("owner with admin off: access is editor, can() evaluates as editor", () => {
  const r = renderWith({
    ...baseEnv,
    access: "editor" as const,
    isOwner: true,
    dbAcls: { restrictedDb: { write: ["submitters"] } },
  });
  expect(r.access).toBe("editor");
  expect(r.isOwner).toBe(true);
  expect(r.can("write", "restrictedDb")).toBe(false);
});

it("owner with admin on: access is owner, can() bypasses", () => {
  const r = renderWith({
    ...baseEnv,
    access: "owner" as const,
    isOwner: true,
    dbAcls: { restrictedDb: { write: ["submitters"] } },
  });
  expect(r.access).toBe("owner");
  expect(r.isOwner).toBe(true);
  expect(r.can("write", "restrictedDb")).toBe(true);
});
```

- [ ] **Step 5: Run tests**

Run: `cd vibes.diy && pnpm vitest run tests/app/use-viewer.test.tsx`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/runtime/VibeContext.tsx vibes.diy/vibe/runtime/use-viewer.ts vibes.diy/tests/app/use-viewer.test.tsx
git commit -m "feat: useViewer() exposes isOwner, access is effective level (#2166)"
```

---

### Task 5: Server-side whoAmI + bridge — thread `isOwner` and `adminMode`

**Files:**

- Modify: `vibes.diy/api/svc/public/who-am-i.ts`
- Modify: `vibes.diy/api/svc/intern/render-vibe.ts`
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts`

- [ ] **Step 1: Update `ResolveWhoAmIArgs` and `ResolvedWhoAmI`**

In `vibes.diy/api/svc/public/who-am-i.ts`:

```typescript
export interface ResolveWhoAmIArgs {
  auth: VerifiedResult | undefined;
  appSlug: string;
  ownerUserSlug: string;
  apiBaseUrl: string;
  adminMode?: boolean;
}

export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  isOwner: boolean;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> | undefined;
}
```

- [ ] **Step 2: Thread `adminMode` to `checkDocAccess()` and return `isOwner`**

In `resolveWhoAmI()`, change the access resolution:

```typescript
// Before:
const access: DocAccessLevel = viewerUserId ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug) : "none";

// After:
const { access, isOwner } = viewerUserId
  ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug, args.adminMode)
  : { access: "none" as DocAccessLevel, isOwner: false };
```

Include `isOwner` in all `Result.Ok(...)` return paths (there are 4 early returns + the final return).

- [ ] **Step 3: Update whoAmI evento handler to forward `adminMode` from request and `isOwner` in response**

In `vibes.diy/api/svc/public/who-am-i.ts`, in the `whoAmIEvento` handler, the request payload now has `adminMode`. Pass it through to `resolveWhoAmI`. Include `isOwner` in the response:

```typescript
const rRes = await resolveWhoAmI(vctx, {
  auth: req._auth,
  appSlug,
  ownerUserSlug,
  apiBaseUrl: vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL,
  adminMode: req.adminMode,
});
// ...
await ctx.send.send(ctx, {
  type: "vibe.res.whoAmI",
  tid: req.tid,
  viewer: r.viewer,
  access: r.access,
  ...(r.isOwner ? { isOwner: r.isOwner } : {}),
  ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
  ...(r.grants !== undefined ? { grants: r.grants } : {}),
} satisfies ResVibeWhoAmI);
```

Note: `ReqVibeWhoAmI` already has `adminMode?` from Task 3.

- [ ] **Step 4: Update srv-sandbox whoAmI handler**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, the `vibeWhoAmI` handler (line 828) forwards the whoAmI request to `vibeDiyApi.whoAmI()`. It needs to:

1. Forward `adminMode` from the request
2. Include `isOwner` in the response

```typescript
// In the handle function:
const { tid, appSlug, ownerHandle, adminMode } = ctx.validated;
const rRes = await vibeDiyApi.whoAmI({ tid, appSlug, ownerHandle, adminMode });
// ...
await ctx.send.send(ctx, {
  tid,
  type: "vibe.res.whoAmI",
  viewer: r.viewer,
  access: r.access,
  ...(r.isOwner !== undefined ? { isOwner: r.isOwner } : {}),
  ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
  ...(r.grants !== undefined ? { grants: r.grants } : {}),
} satisfies ResVibeWhoAmI);
```

- [ ] **Step 5: Update `bootstrapViewer` to include `isOwner`**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, around line 557:

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
        ...(r.isOwner !== undefined ? { isOwner: r.isOwner } : {}),
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants ? { grants: r.grants } : {}),
      },
    })
  );
}
```

- [ ] **Step 6: Update `buildViewerEnvForRender` in render-vibe.ts**

```typescript
async function buildViewerEnvForRender(vctx: VibesApiSQLCtx, args: { appSlug: string; ownerUserSlug: string; apiBaseUrl: string }) {
  const r = await resolveWhoAmI(vctx, { auth: undefined, ...args });
  if (!r.isOk()) return undefined;
  const { viewer, access, isOwner, dbAcls, grants } = r.Ok();
  return {
    viewer,
    access,
    ...(isOwner ? { isOwner } : {}),
    ...(dbAcls ? { dbAcls } : {}),
    ...(grants ? { grants } : {}),
  };
}
```

- [ ] **Step 7: Run type check**

Run: `cd vibes.diy && pnpm tsc --noEmit 2>&1 | head -40`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/vibe/runtime/register-dependencies.ts
git commit -m "feat: whoAmI resolves effective access level, forwards isOwner (#2166)"
```

---

### Task 6: Align `makeHelpers()` with `AccessFnDO`

**Files:**

- Modify: `vibes.diy/api/svc/public/access-function.ts`
- Test: `vibes.diy/api/tests/access-function.test.ts`

- [ ] **Step 1: Write failing tests for grant-aware makeHelpers**

Replace the existing `makeHelpers` tests in `vibes.diy/api/tests/access-function.test.ts`:

```typescript
describe("makeHelpers", () => {
  const user: UserContext = { userHandle: "alice", isOwner: false };

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
Expected: FAIL — `makeHelpers` doesn't accept a second argument, `UserContext` now requires `isOwner`.

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

- [ ] **Step 4: Run tests**

Run: `cd vibes.diy && pnpm vitest run api/tests/access-function.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-function.ts vibes.diy/api/tests/access-function.test.ts
git commit -m "feat: makeHelpers() enforces grants like AccessFnDO (#2166)"
```

---

### Task 7: `/vibe/` route UI — admin toggle with full whoAmI re-fetch

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Add `adminMode` state with localStorage persistence**

Near the existing `isOwner` state (around line 160), add:

```typescript
const adminStorageKey = ownerHandle && appSlug ? `adminMode:${ownerHandle}/${appSlug}` : "";
const [adminMode, setAdminMode] = useState(() => {
  if (typeof window === "undefined" || !adminStorageKey) return false;
  return localStorage.getItem(adminStorageKey) === "true";
});
```

- [ ] **Step 2: Add toggle handler that does full whoAmI re-fetch**

```typescript
const toggleAdmin = useCallback(() => {
  setAdminMode((prev) => {
    const next = !prev;
    if (adminStorageKey) localStorage.setItem(adminStorageKey, String(next));
    setRetryCount((n) => n + 1);
    return next;
  });
}, [adminStorageKey]);
```

The `setRetryCount` bump triggers the existing `getAppByFsId` useEffect to re-fire, which re-resolves access.

- [ ] **Step 3: Gate owner-only chrome on `adminMode`**

Update the `ExpandedVibesPill` props:

```typescript
communityBadgeCount={isOwner && adminMode ? pendingCount : 0}
hasUnpublishedChanges={isOwner && adminMode && shareModal.hasUnpublishedChanges}
```

- [ ] **Step 4: Add toggle UI in the pill area**

Inside the portal (around line 570), after `<ShareModal>`, add an owner-only toggle:

```tsx
{
  isOwner && (
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
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx
git commit -m "feat: admin toggle in /vibe/ route chrome (#2166)"
```

---

### Task 8: Integration — run full check, push, PR

- [ ] **Step 1: Run pnpm fast-check**

Run: `cd vibes.diy && pnpm fast-check`
Expected: All checks pass.

- [ ] **Step 2: Fix any failures**

Address test failures or type errors. Most likely issues:

- Existing tests that construct `UserContext` without `isOwner`
- Existing tests that expect `checkDocAccess()` to return a bare string

- [ ] **Step 3: Run prettier on all changed files**

Run: `npx prettier --write vibes.diy/api/svc/public/access-helpers.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/public/files-asset.ts vibes.diy/api/svc/public/asset-upload-grant.ts vibes.diy/api/svc/public/list-members.ts vibes.diy/api/types/access-function.ts vibes.diy/vibe/types/index.ts vibes.diy/vibe/runtime/vibe.ts vibes.diy/vibe/runtime/VibeContext.tsx vibes.diy/vibe/runtime/use-viewer.ts vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/api/svc/intern/render-vibe.ts vibes.diy/api/svc/public/access-function.ts vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx vibes.diy/api/tests/access-function.test.ts vibes.diy/tests/app/use-viewer.test.tsx`

- [ ] **Step 4: Commit formatting fixes if any**

```bash
git add -u && git commit -m "style: prettier formatting"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: owner admin toggle — effective access level + isOwner (#2166)" --body "$(cat <<'EOF'
## Summary

Separates owner identity from permissions (#2166).

- `checkDocAccess()` returns `{ access, isOwner }` — `access` is `"editor"` when admin off, `"owner"` when admin on
- `useViewer().isOwner` for identity, `useViewer().access` for effective permissions — no split brain
- `user.isOwner` available in access functions for vibe-author owner policy
- Admin toggle in `/vibe/` route chrome (owner-only, outside iframe)
- Full whoAmI re-fetch on toggle — no partial viewer pushes
- `makeHelpers()` aligned with AccessFnDO grant enforcement
- No `adminMode` threading through ACL helpers — decision centralized in `checkDocAccess()`

Closes #2166

## Test plan

- [ ] Owner admin off: `access === "editor"`, `isOwner === true`, `can()` evaluates as editor
- [ ] Owner admin on: `access === "owner"`, `isOwner === true`, `can()` bypasses
- [ ] Access function receives `user.isOwner === true` for owner writes (admin off)
- [ ] Admin on skips access function execution
- [ ] Toggle persists in localStorage, re-fetches full whoAmI
- [ ] Non-owners unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --reviewer CharlieHelps
```
