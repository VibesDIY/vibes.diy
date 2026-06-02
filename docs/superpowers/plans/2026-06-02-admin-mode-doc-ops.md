# Wire adminMode Through Server-Side Document Ops + Bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the owner's admin toggle fully effective server-side — doc ops respect adminMode, bootstrap applies stored adminMode on reload, and tests cover the full toggle lifecycle.

**Architecture:** Store `adminMode` on the per-connection `WSSendProvider` (set during `whoAmI`). Doc op handlers in `app-documents.ts` read it from the connection and pass it to `checkDocAccess()`. On the client, PreviewApp's eager `onRuntimeReady` push reads the stored adminMode from localStorage and includes it in the initial `viewerChanged` event. Integration tests verify the full flow using the existing `createVibeDiyTestCtx` harness.

**Tech Stack:** TypeScript, arktype, Evento (WebSocket message bus), vitest

**Issue:** #2174

---

## Scope Boundaries

**Changes:** `WSSendProvider` (add `adminMode` field), `who-am-i.ts` (set `adminMode` on connection during whoAmI), `app-documents.ts` (read `adminMode` from connection, pass to `checkDocAccess`), `PreviewApp.tsx` (read localStorage adminMode on bootstrap), tests.

**Unchanged:** `access-helpers.ts` (`checkDocAccess` already accepts `adminMode`), `vibe/$ownerHandle/$appSlug.tsx` (toggle logic already works), wire types (`ReqVibeWhoAmI` already has `adminMode?`).

---

### Task 1: Add `adminMode` to `WSSendProvider`

**Files:**

- Modify: `vibes.diy/api/svc/svc-ws-send-provider.ts:25`

- [ ] **Step 1: Add adminMode field to WSSendProvider**

In `vibes.diy/api/svc/svc-ws-send-provider.ts`, add a mutable `adminMode` field after line 25 (`subscribedUserKey`):

```typescript
adminMode = false;
```

This follows the same pattern as `subscribedUserKey` — mutable per-connection state set by a handler.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd vibes.diy && pnpm build 2>&1 | head -10`

Expected: Clean compile (no callers read adminMode yet).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/svc-ws-send-provider.ts
git commit -m "feat: add adminMode field to WSSendProvider connection state"
```

---

### Task 2: Set `adminMode` on the connection during `whoAmI`

**Files:**

- Modify: `vibes.diy/api/svc/public/who-am-i.ts:229-235`

The `whoAmIEvento` handler already extracts `adminMode` from the request and passes it to `resolveWhoAmI`. It also needs to store it on the connection so subsequent doc ops can read it.

- [ ] **Step 1: Store adminMode on the WSSendProvider during whoAmI**

In `vibes.diy/api/svc/public/who-am-i.ts`, find the `whoAmIEvento` handler's `handle` function. After extracting `adminMode` from the request (around line 229), store it on the send provider:

Find the section around line 229:

```typescript
const { appSlug, ownerHandle: ownerUserSlug, adminMode } = req;
```

Add after it (before the `resolveWhoAmI` call):

```typescript
if (ctx.send instanceof WSSendProvider) {
  ctx.send.adminMode = adminMode === true;
}
```

Add the import at the top of the file:

```typescript
import { WSSendProvider } from "../svc-ws-send-provider.js";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd vibes.diy && pnpm build 2>&1 | head -10`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/public/who-am-i.ts
git commit -m "feat: store adminMode on WSSendProvider during whoAmI"
```

---

### Task 3: Pass connection `adminMode` to `checkDocAccess` in doc op handlers

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents.ts:155,524,721,855,940,1058`

Each `checkDocAccess` call needs to read `adminMode` from the connection's `WSSendProvider` and pass it as the 5th argument.

- [ ] **Step 1: Add a helper to extract adminMode from the evento context**

At the top of `app-documents.ts` (after the existing imports, around line 50), add:

```typescript
import { WSSendProvider } from "../svc-ws-send-provider.js";

function connectionAdminMode(ctx: { send: unknown }): boolean {
  return ctx.send instanceof WSSendProvider ? ctx.send.adminMode : false;
}
```

- [ ] **Step 2: Update all 6 checkDocAccess call sites**

**Line 155** (putDoc):
Change from:

```typescript
const docAccessResult = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
```

To:

```typescript
const docAccessResult = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
```

**Line 524** (getDoc):
Change from:

```typescript
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
```

To:

```typescript
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx))
```

**Line 721** (queryDocs):
Change from:

```typescript
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
```

To:

```typescript
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx))
```

**Line 855** (subscribeDocs):
Change from:

```typescript
const { access } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
```

To:

```typescript
const { access } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
```

**Line 940** (subscribeDocs second path):
Change from:

```typescript
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
```

To:

```typescript
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx))
```

**Line 1058** (deleteDoc):
Change from:

```typescript
const { isOwner } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
```

To:

```typescript
const { isOwner } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd vibes.diy && pnpm build 2>&1 | head -10`

Expected: Clean compile.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat: pass connection adminMode to checkDocAccess in all doc op handlers"
```

---

### Task 4: Admin mode suppresses access function enforcement (not execution)

**Files:**

- Modify: `vibes.diy/api/svc/public/access-function.ts:41-76`
- Modify: `vibes.diy/api/svc/public/app-documents.ts:295-321`

When the owner is in admin mode, the access function must still run (it assigns channels, grants, members) but its enforcement must be suppressed — `requireAccess()`/`requireRole()` become no-ops, and `{ forbidden }` results are treated as `{}`.

- [ ] **Step 1: Add adminMode parameter to makeHelpers**

In `vibes.diy/api/svc/public/access-function.ts`, update the `makeHelpers` signature and make guards no-op when adminMode is true:

Change from:

```typescript
export function makeHelpers(user: UserContext | null, grantState?: GrantState): Helpers {
```

To:

```typescript
export function makeHelpers(user: UserContext | null, grantState?: GrantState, adminMode?: boolean): Helpers {
```

Then update `requireAccess` and `requireRole` to return early when adminMode is true:

```typescript
    requireAccess(channelId: string): void {
      if (adminMode === true) return;
      if (user === null) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
      const channels = resolveChannels(user.userHandle);
      if (!channels.has(channelId)) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
    },
    requireRole(roleName: string): void {
      if (adminMode === true) return;
      if (user === null) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
      const roleMembers = gs.members[roleName];
      if (!roleMembers?.includes(user.userHandle)) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
    },
```

- [ ] **Step 2: Pass adminMode through the access function invocation in putDoc**

In `vibes.diy/api/svc/public/app-documents.ts`, the access function is invoked at line 295. The `grantState` is already built and passed to `invokeAccessFn`. The `makeHelpers` call happens inside the sandbox worker — check how `grantState` flows through and ensure `adminMode` reaches `makeHelpers`.

Find where `invokeAccessFn` is called (line 295):

```typescript
const invokeResult = await vctx.invokeAccessFn({
  cid: fnCid,
  doc: { ...req.doc, _id: docId },
  oldDoc,
  user: userContext,
  source: accessFnSource,
  grantState,
});
```

Add `adminMode` to the invocation args:

```typescript
const adminActive = isOwner && connectionAdminMode(ctx);
const invokeResult = await vctx.invokeAccessFn({
  cid: fnCid,
  doc: { ...req.doc, _id: docId },
  oldDoc,
  user: userContext,
  source: accessFnSource,
  grantState,
  adminMode: adminActive,
});
```

Then update the `{ forbidden }` handling at line 304 to suppress when admin:

```typescript
if ("forbidden" in invokeResult) {
  if (adminActive) {
    accessResult = {};
  } else {
    await ctx.send.send(ctx, {
      type: "vibes.diy.res-error",
      error: { message: invokeResult.forbidden },
    } satisfies ResError);
    return Result.Ok(EventoResult.Continue);
  }
}
```

And skip `enforceAllowAnonymous` when admin (line 312-321):

```typescript
if (!adminActive) {
  try {
    enforceAllowAnonymous(invokeResult, userContext);
  } catch (err: unknown) {
    const reason = err instanceof ForbiddenError ? err.forbidden : String(err);
    await ctx.send.send(ctx, {
      type: "vibes.diy.res-error",
      error: { message: reason },
    } satisfies ResError);
    return Result.Ok(EventoResult.Continue);
  }
}
```

- [ ] **Step 3: Wire adminMode through invokeAccessFn interface**

Check the `invokeAccessFn` type and the sandbox worker that calls `makeHelpers` — ensure `adminMode` flows from the invocation args through to `makeHelpers`. The exact file depends on how `invokeAccessFn` is implemented (likely `access-fn-invoke.ts` or similar). Add `adminMode?: boolean` to the invoke args type and pass it to `makeHelpers(user, grantState, adminMode)` inside the worker.

Run: `grep -rn 'invokeAccessFn' vibes.diy/api/ --include='*.ts' | head -10` to find the implementation.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd vibes.diy && pnpm build 2>&1 | head -10`

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-function.ts vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat: admin mode suppresses access function enforcement, not execution"
```

---

### Task 5: Bootstrap applies stored adminMode on reload

_(was Task 4)_

**Files:**

- Modify: `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx:196-206`

The `onRuntimeReady` effect pushes an eager `viewerChanged` with `access: "override"` so the iframe doesn't flash read-only. It needs to also read the stored `adminMode` from localStorage and set `access` accordingly — `"override"` when admin is on, `"editor"` when off.

- [ ] **Step 1: Update the onRuntimeReady effect to read stored adminMode**

In `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx`, find the `onRuntimeReady` effect (around line 196). The current code:

```typescript
useEffect(() => {
  if (!srvVibeSandbox || !ownerHandle || !appSlug) return;
  return srvVibeSandbox.onRuntimeReady(() => {
    const msg: EvtVibeViewerChanged = {
      type: "vibe.evt.viewerChanged",
      viewer: null,
      access: "override",
    };
    srvVibeSandbox.pushViewerChanged(msg);
  }) as () => void;
}, [srvVibeSandbox, ownerHandle, appSlug]);
```

Change to:

```typescript
useEffect(() => {
  if (!srvVibeSandbox || !ownerHandle || !appSlug) return;
  return srvVibeSandbox.onRuntimeReady(() => {
    const adminKey = `adminMode:${ownerHandle}/${appSlug}`;
    const storedAdmin = localStorage.getItem(adminKey) === "true";
    const msg: EvtVibeViewerChanged = {
      type: "vibe.evt.viewerChanged",
      viewer: null,
      access: storedAdmin ? "override" : "editor",
      isOwner: true,
    };
    srvVibeSandbox.pushViewerChanged(msg);
  }) as () => void;
}, [srvVibeSandbox, ownerHandle, appSlug]);
```

This way, on reload with adminMode persisted as "true", the iframe immediately gets `access: "override"`. When adminMode is off (or not set), it gets `access: "editor"` with `isOwner: true`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd vibes.diy && pnpm build 2>&1 | head -10`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx
git commit -m "feat: bootstrap reads stored adminMode so iframe access is correct on reload"
```

---

### Task 6: Integration tests for adminMode in checkDocAccess

**Files:**

- Create: `vibes.diy/api/tests/check-doc-access-admin.test.ts`

Test `checkDocAccess()` directly with `adminMode` true/false. This is a unit-level integration test — it hits the real DB but doesn't go through the full WebSocket evento stack.

- [ ] **Step 1: Write the test file**

Create `vibes.diy/api/tests/check-doc-access-admin.test.ts`:

```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { checkDocAccess } from "../svc/public/access-helpers.js";

describe("checkDocAccess adminMode", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerUserId: string;
  let visitorUserId: string;
  let appSlug: string;
  let ownerHandle: string;
  let vctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["appCtx"];

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const testCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = testCtx.appCtx;

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 });
    const visitorUser = await createTestUser({ sthis, deviceCA, seqUserId: 400 });
    ownerUserId = ownerUser.userId;
    visitorUserId = visitorUser.userId;

    ownerHandle = `admin-test-owner-${Date.now()}`;
    appSlug = `admin-test-app-${Date.now()}`;

    // Register owner handle binding
    await vctx.sql.db.insert(vctx.sql.tables.handleBinding).values({
      handle: ownerHandle,
      userId: ownerUserId,
    });
  });

  it("owner with adminMode=false gets access=editor, isOwner=true", async () => {
    const result = await checkDocAccess(vctx, ownerUserId, appSlug, ownerHandle, false);
    expect(result.access).toBe("editor");
    expect(result.isOwner).toBe(true);
  });

  it("owner with adminMode=true gets access=owner, isOwner=true", async () => {
    const result = await checkDocAccess(vctx, ownerUserId, appSlug, ownerHandle, true);
    expect(result.access).toBe("override");
    expect(result.isOwner).toBe(true);
  });

  it("owner with adminMode=undefined gets access=editor, isOwner=true", async () => {
    const result = await checkDocAccess(vctx, ownerUserId, appSlug, ownerHandle);
    expect(result.access).toBe("editor");
    expect(result.isOwner).toBe(true);
  });

  it("non-owner is unaffected by adminMode", async () => {
    const resultOff = await checkDocAccess(vctx, visitorUserId, appSlug, ownerHandle, false);
    expect(resultOff.access).toBe("none");
    expect(resultOff.isOwner).toBe(false);

    const resultOn = await checkDocAccess(vctx, visitorUserId, appSlug, ownerHandle, true);
    expect(resultOn.access).toBe("none");
    expect(resultOn.isOwner).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vibes.diy && npx vitest run api/tests/check-doc-access-admin.test.ts --config api/tests/vitest.config.ts 2>&1 | tail -20`

Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/check-doc-access-admin.test.ts
git commit -m "test: integration tests for checkDocAccess with adminMode"
```

---

### Task 7: Run pnpm fast-check and format

- [ ] **Step 1: Format all changed files**

```bash
npx prettier --write vibes.diy/api/svc/svc-ws-send-provider.ts vibes.diy/api/svc/public/who-am-i.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx vibes.diy/api/tests/check-doc-access-admin.test.ts
```

- [ ] **Step 2: Run pnpm fast-check**

```bash
cd vibes.diy && pnpm fast-check
```

Expected: Clean pass.

- [ ] **Step 3: Commit any formatting changes**

```bash
git add -A && git commit -m "style: format"
```
