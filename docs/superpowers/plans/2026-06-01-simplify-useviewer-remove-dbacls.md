# Simplify useViewer: Remove dbAcls, Make can() Membership-Only

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `dbAcls` plumbing from the client-side runtime so `useViewer().can()` becomes a simple membership check. Access functions now handle fine-grained data permissions server-side.

**Architecture:** Strip `dbAcls?` from wire types (`ResVibeWhoAmI`, `EvtVibeViewerChanged`) and the client-side `ViewerEnv`. Simplify `can(action)` to use `canRead`/`canWrite` role checks (no `dbName` parameter). Server-side ACL enforcement (`db-acl-resolver`, `ensure-app-settings`) is unchanged — only the client-facing plumbing is removed.

**Tech Stack:** TypeScript, React hooks, arktype schemas

**Issue:** #2134

---

## Scope Boundaries

**Changes:** Client runtime types, useViewer hook, wire types, plumbing layers, server handlers that build wire responses, tests, prompt docs.

**Unchanged:** Server-side `db-acl-resolver.ts`, `ensure-app-settings.ts`, `api/types/db-acls.ts`, `resolveWhoAmI()` function internals, `ShareModal.tsx` (uses API layer, not useViewer), `ReqSetDbAcl` (sandbox set-db-acl stays — it's a server-side settings write).

---

### Task 1: Strip dbAcls from wire types and ViewerEnv schema

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts:593-657`
- Modify: `vibes.diy/vibe/runtime/vibe.ts:7-24`

- [ ] **Step 1: Remove dbAcls from ResVibeWhoAmI and EvtVibeViewerChanged in vibe/types/index.ts**

In `vibes.diy/vibe/types/index.ts`, remove the `dbAcls?` field from both type definitions.

`ResVibeWhoAmI` (around line 596-601) — change from:

```typescript
// `viewer: null` means anonymous. The arktype `null` literal matches
// encoded JSON null.
//
// `access` is the app-scoped role. `dbAcls` carries any per-db overrides
// configured for this app — missing entries fall back to the role gate
// in the sandbox's `can()` helper.
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
}).and(Base);
```

To:

```typescript
export const ResVibeWhoAmI = type({
  type: "'vibe.res.whoAmI'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
}).and(Base);
```

`EvtVibeViewerChanged` (around line 653-658) — change from:

```typescript
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
});
```

To:

```typescript
export const EvtVibeViewerChanged = type({
  type: "'vibe.evt.viewerChanged'",
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
});
```

Also check whether `dbAcl` is still imported at line 1. It IS still needed for `ReqSetDbAcl` (line 446). Keep the import. `DbAcl` type re-export (line 7) is also still needed by `ReqSetDbAcl` consumers.

- [ ] **Step 2: Remove dbAcl schema from vibe/runtime/vibe.ts**

In `vibes.diy/vibe/runtime/vibe.ts`, remove the local `dbAcl` schema definition and the `dbAcls?` field from `viewerEnv`.

Change from:

```typescript
// `dbAcl` shape — matches @vibes.diy/api-types' DbAcl, defined locally
// for the same reason db-acl-allows.ts redefines it: api-types pulls
// cloudflare/fireproof server-side deps that don't belong in a browser
// runtime bundle. Schema kept in lockstep with api-types/db-acls.ts.
const dbAcl = type({
  "read?": "('members' | 'editors' | 'submitters' | 'readers')[]",
  "write?": "('members' | 'editors' | 'submitters' | 'readers')[]",
  "delete?": "('members' | 'editors' | 'submitters' | 'readers')[]",
});

// Server-computed viewer info, embedded into the iframe's HTML by
// render-vibe so the very first React render already has identity.
// viewer.avatarUrl is the absolute URL for the viewer's avatar — opaque
// to app code (just a string, not a function of ownerHandle).
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
  "dbAcls?": type({ "[string]": dbAcl }),
});
```

To:

```typescript
export const viewerEnv = type({
  viewer: viewerPayload.or("null"),
  access: docAccessLevel,
});
```

- [ ] **Step 3: Verify TypeScript compiles (expect errors in downstream files)**

Run: `cd vibes.diy && npx tsc --noEmit 2>&1 | head -40`

Expected: TypeScript errors in files that reference `dbAcls` on `ViewerEnv` or `ResVibeWhoAmI` (use-viewer.ts, VibeContext.tsx, register-dependencies.ts, srv-sandbox.ts, who-am-i.ts, render-vibe.ts, tests). These will be fixed in subsequent tasks.

---

### Task 2: Simplify db-acl-allows.ts and use-viewer.ts

**Files:**

- Modify: `vibes.diy/vibe/runtime/db-acl-allows.ts`
- Modify: `vibes.diy/vibe/runtime/use-viewer.ts`

- [ ] **Step 1: Strip db-acl-allows.ts down to canRead/canWrite**

Replace the entire file content of `vibes.diy/vibe/runtime/db-acl-allows.ts` with:

```typescript
import type { DocAccessLevel } from "@vibes.diy/vibe-types";

export const canRead = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "viewer";

export const canWrite = (level: DocAccessLevel): boolean => level === "owner" || level === "editor" || level === "submitter";
```

This removes `DbAclSubject`, `DbAcl`, `inGroup`, and `aclAllows`. Only `canRead` and `canWrite` survive.

- [ ] **Step 2: Simplify use-viewer.ts — remove dbAcls and dbName param**

Replace the entire file content of `vibes.diy/vibe/runtime/use-viewer.ts` with:

```typescript
import React from "react";
import { canRead, canWrite } from "./db-acl-allows.js";
import { useVibeContext } from "./VibeContext.js";
import type { ViewerEnv } from "./vibe.js";
import { ViewerTagImpl, type ViewerTagProps } from "./use-viewer-tag.js";

type ViewerPayload = NonNullable<ViewerEnv["viewer"]>;
type DocAccessLevel = ViewerEnv["access"];

export interface UseViewerResult {
  readonly viewer: ViewerPayload | null;
  readonly access: DocAccessLevel;
  readonly can: (action: "read" | "write" | "delete") => boolean;
  /** True while viewer identity has not yet been resolved (e.g. preview mode
   *  before the parent pushes vibe.evt.viewerChanged). Gate access-gated UI
   *  on !isViewerPending rather than rendering the anonymous fallback. */
  readonly isViewerPending: boolean;
  /** Inline user pill. Renders the current viewer (editable) when called
   *  with no props. Pass `ownerHandle` to render another user read-only. */
  readonly ViewerTag: React.FC<ViewerTagProps>;
}

export function useViewer(): UseViewerResult {
  const { mountParams } = useVibeContext();
  const env = mountParams.viewerEnv;
  const isViewerPending = env === undefined;
  const viewer = env?.viewer ?? null;
  const access: DocAccessLevel = env?.access ?? "none";

  function can(action: "read" | "write" | "delete"): boolean {
    return action === "read" ? canRead(access) : canWrite(access);
  }

  const ViewerTag: React.FC<ViewerTagProps> = React.useCallback(
    (props: ViewerTagProps) => React.createElement(ViewerTagImpl, { ...props, _viewer: viewer }),
    [viewer]
  );

  return { viewer, access, can, isViewerPending, ViewerTag };
}
```

Key changes:

- Removed `dbAcls` from `UseViewerResult` interface
- Removed `dbName` parameter from `can()` — old vibes passing a second arg still work (JS ignores extra args)
- `can()` now delegates directly to `canRead`/`canWrite`
- Import changed from `aclAllows, type DbAcl` to `canRead, canWrite`

- [ ] **Step 3: Verify these two files compile**

Run: `cd vibes.diy && npx tsc --noEmit --pretty 2>&1 | grep -E 'db-acl-allows|use-viewer\.ts' | head -5`

Expected: No errors in these two files (but errors may remain in other files).

---

### Task 3: Remove dbAcls from plumbing layers

**Files:**

- Modify: `vibes.diy/vibe/runtime/VibeContext.tsx:58-62`
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts:564-568`
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts:853-859`

- [ ] **Step 1: Remove dbAcls spread from VibeContext.tsx**

In `vibes.diy/vibe/runtime/VibeContext.tsx`, the `setViewerEnv` call (around line 58-62):

Change from:

```typescript
setViewerEnv({
  viewer: event.data.viewer,
  access: event.data.access,
  ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
});
```

To:

```typescript
setViewerEnv({
  viewer: event.data.viewer,
  access: event.data.access,
});
```

- [ ] **Step 2: Remove dbAcls from bootstrapViewer in register-dependencies.ts**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, the `bootstrapViewer` function (around line 561-570):

Change from:

```typescript
window.dispatchEvent(
  new MessageEvent("message", {
    data: {
      type: "vibe.evt.viewerChanged",
      viewer: r.viewer,
      access: r.access,
      ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
    },
  })
);
```

To:

```typescript
window.dispatchEvent(
  new MessageEvent("message", {
    data: {
      type: "vibe.evt.viewerChanged",
      viewer: r.viewer,
      access: r.access,
    },
  })
);
```

- [ ] **Step 3: Remove dbAcls from vibeWhoAmI in srv-sandbox.ts**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, the vibeWhoAmI handler (around line 853-859):

Change from:

```typescript
await ctx.send.send(ctx, {
  tid,
  type: "vibe.res.whoAmI",
  viewer: r.viewer,
  access: r.access,
  ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
} satisfies ResVibeWhoAmI);
```

To:

```typescript
await ctx.send.send(ctx, {
  tid,
  type: "vibe.res.whoAmI",
  viewer: r.viewer,
  access: r.access,
} satisfies ResVibeWhoAmI);
```

---

### Task 4: Update server-side handlers that build wire responses

**Files:**

- Modify: `vibes.diy/api/svc/public/who-am-i.ts:155-161`
- Modify: `vibes.diy/api/svc/intern/render-vibe.ts:31-32`

- [ ] **Step 1: Stop sending dbAcls in whoAmIEvento handler**

In `vibes.diy/api/svc/public/who-am-i.ts`, the `whoAmIEvento` handler (around line 155-161):

Change from:

```typescript
await ctx.send.send(ctx, {
  type: "vibe.res.whoAmI",
  tid: req.tid,
  viewer: r.viewer,
  access: r.access,
  ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
} satisfies ResVibeWhoAmI);
```

To:

```typescript
await ctx.send.send(ctx, {
  type: "vibe.res.whoAmI",
  tid: req.tid,
  viewer: r.viewer,
  access: r.access,
} satisfies ResVibeWhoAmI);
```

Note: `resolveWhoAmI()` still returns `dbAcls` in its `ResolvedWhoAmI` interface — it's just no longer forwarded to the client. The function itself is unchanged.

- [ ] **Step 2: Stop including dbAcls in render-vibe viewerEnv**

In `vibes.diy/api/svc/intern/render-vibe.ts` (around line 31-32):

Change from:

```typescript
const { viewer, access, dbAcls } = r.Ok();
return { viewer, access, ...(dbAcls ? { dbAcls } : {}) };
```

To:

```typescript
const { viewer, access } = r.Ok();
return { viewer, access };
```

- [ ] **Step 3: Verify build compiles**

Run: `cd vibes.diy && npx tsc --noEmit 2>&1 | head -20`

Expected: No TypeScript errors in production code (test errors expected until Task 5).

---

### Task 5: Update all tests

**Files:**

- Modify: `vibes.diy/tests/app/use-viewer.test.tsx`
- Modify: `vibes.diy/tests/app/vibe-sandbox-api-who-am-i.test.ts`
- Modify: `vibes.diy/api/tests/vibe-mount-params.test.ts`
- Modify: `vibes.diy/api/tests/vibe-types-viewer.test.ts`
- Modify: `vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts`
- Delete: `vibes.diy/api/tests/db-acl-allows.test.ts`
- Delete: `vibes.diy/api/tests/db-acl-allows-parity.test.ts`

- [ ] **Step 1: Rewrite use-viewer.test.tsx**

Replace the entire file `vibes.diy/tests/app/use-viewer.test.tsx` with:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VibeContextProvider, type ViewerEnv } from "@vibes.diy/vibe-runtime";
import { useViewer, type UseViewerResult } from "@vibes.diy/use-vibes-base";

function Probe({ onR }: { onR: (r: ReturnType<typeof useViewer>) => void }) {
  const r = useViewer();
  onR(r);
  return null;
}

const baseEnv = {
  viewer: { userHandle: "alice", displayName: "Alice", avatarUrl: "https://api.example.com/u/alice/avatar" },
  access: "owner" as const,
};

function renderWith(env: ViewerEnv | undefined): UseViewerResult {
  let captured: UseViewerResult = {
    viewer: null,
    access: "none",
    can: () => false,
    isViewerPending: true,
    ViewerTag: () => null,
  };
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, ...(env ? { viewerEnv: env } : {}) }}>
      <Probe onR={(r) => (captured = r)} />
    </VibeContextProvider>
  );
  return captured;
}

describe("useViewer", () => {
  it("exposes viewer + access", () => {
    const r = renderWith(baseEnv);
    expect(r.viewer?.userHandle).toBe("alice");
    expect(r.access).toBe("owner");
  });

  it("returns sensible defaults when no viewerEnv was provided", () => {
    const r = renderWith(undefined);
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
  });

  it("can(write) checks membership via access level", () => {
    const owner = renderWith(baseEnv);
    expect(owner.can("write")).toBe(true);
    expect(owner.can("read")).toBe(true);

    const viewer = renderWith({
      viewer: { userHandle: "bob", avatarUrl: "https://api/u/bob/avatar" },
      access: "viewer" as const,
    });
    expect(viewer.can("read")).toBe(true);
    expect(viewer.can("write")).toBe(false);

    const submitter = renderWith({
      viewer: { userHandle: "carol", avatarUrl: "https://api/u/carol/avatar" },
      access: "submitter" as const,
    });
    expect(submitter.can("write")).toBe(true);
    expect(submitter.can("read")).toBe(false);

    const none = renderWith({ viewer: null, access: "none" as const });
    expect(none.can("write")).toBe(false);
    expect(none.can("read")).toBe(false);
  });

  it("viewer.avatarUrl is exposed as an opaque string", () => {
    const r = renderWith(baseEnv);
    expect(r.viewer?.avatarUrl).toBe("https://api.example.com/u/alice/avatar");
  });

  it("isViewerPending is true when viewerEnv is undefined, false when set", () => {
    expect(renderWith(undefined).isViewerPending).toBe(true);
    expect(renderWith(baseEnv).isViewerPending).toBe(false);
  });
});
```

- [ ] **Step 2: Update vibe-sandbox-api-who-am-i.test.ts**

In `vibes.diy/tests/app/vibe-sandbox-api-who-am-i.test.ts`:

In the first test (around line 44-63), remove `dbAcls` from the mock response and the assertion:

Change the listener reply (around line 44-54) from:

```typescript
listeners.forEach((h) =>
  h({
    data: {
      type: "vibe.res.whoAmI",
      tid: sentTid,
      viewer: { userHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
      dbAcls: { comments: { write: ["members"], delete: ["members"] } },
    },
  } as MessageEvent)
);
```

To:

```typescript
listeners.forEach((h) =>
  h({
    data: {
      type: "vibe.res.whoAmI",
      tid: sentTid,
      viewer: { userHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
    },
  } as MessageEvent)
);
```

Remove the dbAcls assertion (line 63):

```typescript
expect(evt.data.dbAcls).toEqual({ comments: { write: ["members"], delete: ["members"] } });
```

- [ ] **Step 3: Update vibe-mount-params.test.ts**

In `vibes.diy/api/tests/vibe-mount-params.test.ts`, update the test at line 21-31:

Change from:

```typescript
it("accepts viewerEnv with viewer + dbAcls", () => {
  const r = vibeMountParams({
    usrEnv: {},
    viewerEnv: {
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.vibes.diy/u/alice/avatar" },
      access: "owner",
      dbAcls: { comments: { write: ["members"] } },
    },
  });
  expect(r instanceof type.errors).toBe(false);
});
```

To:

```typescript
it("accepts viewerEnv with viewer", () => {
  const r = vibeMountParams({
    usrEnv: {},
    viewerEnv: {
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.vibes.diy/u/alice/avatar" },
      access: "owner",
    },
  });
  expect(r instanceof type.errors).toBe(false);
});
```

- [ ] **Step 4: Update vibe-types-viewer.test.ts**

In `vibes.diy/api/tests/vibe-types-viewer.test.ts`, update the test at line 27-37:

Change from:

```typescript
it("validates signed-in response with dbAcls", () => {
  expect(
    isResVibeWhoAmI({
      type: "vibe.res.whoAmI",
      tid: "abc",
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
      dbAcls: { comments: { write: ["members"] } },
    })
  ).toBe(true);
});
```

To:

```typescript
it("validates signed-in response", () => {
  expect(
    isResVibeWhoAmI({
      type: "vibe.res.whoAmI",
      tid: "abc",
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
    })
  ).toBe(true);
});
```

- [ ] **Step 5: Update srv-sandbox-who-am-i.test.ts**

In `vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts`:

Remove the `import type { DbAcl } from "@vibes.diy/api-types";` at line 6.

Delete the entire "passes dbAcls through when present" test (lines 96-124).

- [ ] **Step 6: Delete db-acl-allows test files**

Delete `vibes.diy/api/tests/db-acl-allows.test.ts` and `vibes.diy/api/tests/db-acl-allows-parity.test.ts`. These test `aclAllows` and `inGroup` which no longer exist in the client.

Run:

```bash
git rm vibes.diy/api/tests/db-acl-allows.test.ts vibes.diy/api/tests/db-acl-allows-parity.test.ts
```

- [ ] **Step 7: Run tests**

Run: `cd vibes.diy && pnpm fast-check`

Expected: All tests pass, no TypeScript errors.

---

### Task 6: Update prompt docs

**Files:**

- Modify: `prompts/pkg/llms/use-viewer.md`

- [ ] **Step 1: Update use-viewer.md API docs**

In `prompts/pkg/llms/use-viewer.md`, update the `can()` description (line 32):

Change from:

```markdown
- `can(action, dbName?)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Pass a `dbName` for multi-db apps; omit for single-db apps. Use it to hide forms when the viewer can't post.
```

To:

```markdown
- `can(action)` — `true`/`false` for `"read"`, `"write"`, `"delete"`. Use it to hide forms when the viewer can't post. Access functions handle per-database permissions server-side.
```

- [ ] **Step 2: Update code examples to remove dbName**

In `prompts/pkg/llms/use-viewer.md`, update the two code examples that use `can("write", "comments")`:

Lines 51-54 — change:

```jsx
{
  viewer && !can("write", "comments") && <p>Contact the owner to request write access so you can post.</p>;
}
{
  viewer && can("write", "comments") && <form>...</form>;
}
```

To:

```jsx
{
  viewer && !can("write") && <p>Contact the owner to request write access so you can post.</p>;
}
{
  viewer && can("write") && <form>...</form>;
}
```

Lines 106-109 — change:

```jsx
          {viewer && !can("write", "comments") && (
            <p>Contact the owner to request write access so you can post.</p>
          )}
          {viewer && can("write", "comments") && (
```

To:

```jsx
          {viewer && !can("write") && (
            <p>Contact the owner to request write access so you can post.</p>
          )}
          {viewer && can("write") && (
```

- [ ] **Step 3: Run pnpm fast-check**

Run: `cd vibes.diy && pnpm fast-check`

Expected: All checks pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: simplify useViewer — remove dbAcls, make can() membership-only (#2134)

Strip dbAcls from wire types (ResVibeWhoAmI, EvtVibeViewerChanged) and
the client-side ViewerEnv. can(action) now delegates to canRead/canWrite
without consulting per-database ACLs — access functions handle
fine-grained data permissions server-side.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
