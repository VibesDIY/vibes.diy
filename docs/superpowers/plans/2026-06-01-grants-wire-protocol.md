# Grants Wire Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire resolved access function grants (roles + channels) into the viewer env so the client receives them alongside existing dbAcls.

**Architecture:** `resolveWhoAmI` queries `AccessFunctionBindings` to discover which databases have access functions, then queries `AccessFnOutputs` with `hasGrants = 1` and builds a `GrantReduce` per database. The resolved roles + channels are sent as a `grants?` field on the wire types, forwarded through the same plumbing as `dbAcls`.

**Tech Stack:** TypeScript, arktype schemas, Drizzle ORM, GrantReduce class

**Issue:** #2142

---

### Task 1: Add `grants?` to wire types and ViewerEnv schema

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts:596-601,653-658`
- Modify: `vibes.diy/vibe/runtime/vibe.ts:21-24`

- [ ] **Step 1: Add grants schema to vibe/types/index.ts**

Add a `grantEntry` schema near the top of the file (after the existing `dbAcl` import at line 1), then add `"grants?"` to both `ResVibeWhoAmI` and `EvtVibeViewerChanged`.

In `vibes.diy/vibe/types/index.ts`, after the existing imports, add the grant entry schema. Then add the field to both type definitions.

For `ResVibeWhoAmI` (around line 596-601), add after the `"dbAcls?"` line:

```typescript
  "grants?": type({ "[string]": type({ channels: "string[]", roles: "string[]" }) }),
```

For `EvtVibeViewerChanged` (around line 653-658), add the same line after the `"dbAcls?"` line:

```typescript
  "grants?": type({ "[string]": type({ channels: "string[]", roles: "string[]" }) }),
```

- [ ] **Step 2: Add grants to viewerEnv in vibe/runtime/vibe.ts**

In `vibes.diy/vibe/runtime/vibe.ts`, the `viewerEnv` type (around line 21-24). Add after the `"dbAcls?"` line:

```typescript
  "grants?": type({ "[string]": type({ channels: "string[]", roles: "string[]" }) }),
```

- [ ] **Step 3: Verify types compile**

Run: `cd vibes.diy && npx tsc --noEmit 2>&1 | grep -E 'vibe\.ts|types/index' | head -5`

Expected: No errors in these files.

---

### Task 2: Forward grants through plumbing layers

**Files:**

- Modify: `vibes.diy/vibe/runtime/VibeContext.tsx:58-62`
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts:561-570`
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts:853-859`
- Modify: `vibes.diy/api/svc/intern/render-vibe.ts:31-32`

Each of these files already conditionally forwards `dbAcls`. Add the same pattern for `grants`.

- [ ] **Step 1: Forward grants in VibeContext.tsx**

In `vibes.diy/vibe/runtime/VibeContext.tsx`, the `setViewerEnv` call (around line 58-62). Add a `grants` spread after the `dbAcls` spread:

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
  ...(event.data.dbAcls ? { dbAcls: event.data.dbAcls } : {}),
  ...(event.data.grants ? { grants: event.data.grants } : {}),
});
```

- [ ] **Step 2: Forward grants in register-dependencies.ts bootstrapViewer**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, the `bootstrapViewer` event dispatch (around line 561-570). Add grants spread:

Change from:

```typescript
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
```

To:

```typescript
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants ? { grants: r.grants } : {}),
```

- [ ] **Step 3: Forward grants in srv-sandbox.ts vibeWhoAmI handler**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, the vibeWhoAmI response (around line 853-859). Add grants spread:

Change from:

```typescript
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
```

To:

```typescript
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
```

- [ ] **Step 4: Forward grants in render-vibe.ts**

In `vibes.diy/api/svc/intern/render-vibe.ts` (around line 31-32). Add grants to the return value:

Change from:

```typescript
const { viewer, access, dbAcls } = r.Ok();
return { viewer, access, ...(dbAcls ? { dbAcls } : {}) };
```

To:

```typescript
const { viewer, access, dbAcls, grants } = r.Ok();
return { viewer, access, ...(dbAcls ? { dbAcls } : {}), ...(grants ? { grants } : {}) };
```

---

### Task 3: Compute resolved grants in resolveWhoAmI

This is the core change. Add grant resolution to `resolveWhoAmI()` in `vibes.diy/api/svc/public/who-am-i.ts`.

**Files:**

- Modify: `vibes.diy/api/svc/public/who-am-i.ts:1-124`

- [ ] **Step 1: Add imports**

In `vibes.diy/api/svc/public/who-am-i.ts`, add imports for GrantReduce and drizzle helpers. Add near the existing imports:

```typescript
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { and, eq, inArray } from "drizzle-orm";
```

Check which of these are already imported (some drizzle helpers may already be there). Only add what's missing.

- [ ] **Step 2: Add grants to ResolvedWhoAmI interface**

Change the `ResolvedWhoAmI` interface from:

```typescript
export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  dbAcls: Record<string, DbAcl> | undefined;
}
```

To:

```typescript
export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; roles: string[] }> | undefined;
}
```

- [ ] **Step 3: Add resolveGrants helper function**

Add a new helper function before `resolveWhoAmI`. This follows the same pattern as `app-documents.ts` for querying AccessFnOutputs and building GrantReduce, but does it for ALL databases with access functions for this app:

```typescript
async function resolveGrants(
  vctx: VibesApiSQLCtx,
  ownerUserSlug: string,
  appSlug: string,
  viewerSlug: string | undefined
): Promise<Record<string, { channels: string[]; roles: string[] }> | undefined> {
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const afbRows = await vctx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
    .from(tAfb)
    .where(and(eq(tAfb.userHandle, ownerUserSlug), eq(tAfb.appSlug, appSlug)));

  if (afbRows.length === 0) return undefined;

  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const grants: Record<string, { channels: string[]; roles: string[] }> = {};

  for (const afb of afbRows) {
    const storedOutputs = await vctx.sql.db
      .select({ docId: tOutputs.docId, output: tOutputs.output })
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.userHandle, ownerUserSlug),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, afb.dbName),
          eq(tOutputs.fnCid, afb.accessFnCid),
          eq(tOutputs.hasGrants, 1)
        )
      );

    const reduce = new GrantReduce();
    for (const row of storedOutputs) {
      reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
    }

    const channels = viewerSlug ? Array.from(reduce.resolveEffectiveChannels(viewerSlug)) : [];
    const publicCh = Array.from(reduce.publicChannels);
    const allChannels = [...new Set([...channels, ...publicCh])];

    const roles: string[] = [];
    if (viewerSlug) {
      for (const [roleName, members] of reduce.effectiveMembers) {
        if (members.has(viewerSlug)) roles.push(roleName);
      }
    }

    grants[afb.dbName] = { channels: allChannels, roles };
  }

  return Object.keys(grants).length > 0 ? grants : undefined;
}
```

- [ ] **Step 4: Call resolveGrants from resolveWhoAmI**

In the `resolveWhoAmI` function, add the grants resolution call. Insert it after the viewerSlug is resolved (around line 110-120), just before the final `return Result.Ok(...)`.

The viewer slug is already computed as `viewerSlug` by line ~110. Add the grants call and include it in the return:

Before the final return statement (`return Result.Ok({ viewer: ..., access, dbAcls })`), add:

```typescript
const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, viewerSlug);
```

Then change the return from:

```typescript
return Result.Ok({
  viewer: { userHandle: viewerSlug, displayName, avatarUrl },
  access,
  dbAcls,
});
```

To:

```typescript
return Result.Ok({
  viewer: { userHandle: viewerSlug, displayName, avatarUrl },
  access,
  dbAcls,
  grants,
});
```

Also update the early returns that return `{ viewer: null, access, dbAcls }` to include `grants: undefined`:

There are three early returns (around lines 78, 82, 113) that return `{ viewer: null, access, dbAcls }`. Change each to `{ viewer: null, access, dbAcls, grants: undefined }`.

- [ ] **Step 5: Update whoAmIEvento handler to forward grants**

In the same file, the `whoAmIEvento` handler (around line 155-161) already forwards dbAcls. Add grants:

Change from:

```typescript
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
```

To:

```typescript
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
```

- [ ] **Step 6: Verify build**

Run: `cd vibes.diy && npx tsc --noEmit 2>&1 | head -20`

Expected: No TypeScript errors in production code.

---

### Task 4: Update tests

**Files:**

- Modify: `vibes.diy/api/tests/who-am-i.test.ts`
- Modify: `vibes.diy/api/tests/vibe-types-viewer.test.ts`
- Modify: `vibes.diy/api/tests/vibe-mount-params.test.ts`
- Modify: `vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts`
- Modify: `vibes.diy/tests/app/vibe-sandbox-api-who-am-i.test.ts`

- [ ] **Step 1: Update vibe-types-viewer.test.ts**

Add a test for the grants field in `ResVibeWhoAmI` validation. Add after the existing "validates signed-in response with dbAcls" test:

```typescript
it("validates signed-in response with grants", () => {
  expect(
    isResVibeWhoAmI({
      type: "vibe.res.whoAmI",
      tid: "abc",
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
      grants: { comments: { channels: ["general"], roles: ["moderator"] } },
    })
  ).toBe(true);
});
```

- [ ] **Step 2: Update vibe-mount-params.test.ts**

Add a test for viewerEnv with grants:

```typescript
it("accepts viewerEnv with grants", () => {
  const r = vibeMountParams({
    usrEnv: {},
    viewerEnv: {
      viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.vibes.diy/u/alice/avatar" },
      access: "owner",
      grants: { chat: { channels: ["general", "random"], roles: ["admin"] } },
    },
  });
  expect(r instanceof type.errors).toBe(false);
});
```

- [ ] **Step 3: Run pnpm fast-check**

Run: `cd vibes.diy && pnpm fast-check`

Expected: All checks pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add resolved grants to wire protocol (#2142)

Run GrantReduce during resolveWhoAmI to send the viewer's resolved
roles and channels alongside existing dbAcls. Databases with access
function exports get a grants entry with the viewer's effective
channels and role memberships.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
