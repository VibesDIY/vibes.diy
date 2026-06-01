# Firefly Grant Reduce + Channel Enforcement — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize channel/role memberships from access function outputs and make `requireAccess`/`requireRole` enforce them, with per-database access function binding via named exports in `access.js`.

**Architecture:** Access function outputs are stored alongside each doc in an `AccessFnOutputs` table, keyed by the access function CID. On each write, the reduce is computed on demand from stored outputs — no separate stateful DO, no hydration protocol. Push-time export parsing extracts named exports from access.js and creates per-db binding rows.

**Tech Stack:** QuickJS WASM (`@cf-wasm/quickjs`), Drizzle ORM, D1/Postgres

**Spec:** `docs/superpowers/specs/2026-05-31-firefly-grant-reduce-design.md` (v2)

---

## File Structure

| File                                                       | Responsibility                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Done: `vibes.diy/api/svc/public/grant-reduce.ts`           | Pure reduce logic: GrantReduce, extractContribution, DocContribution. No runtime deps. |
| Done: `vibes.diy/api/tests/access-fn-reduce.test.ts`       | 13 unit tests for reduce logic                                                         |
| New: `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`    | Add `AccessFnOutputs` table                                                            |
| New: `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`        | Add `AccessFnOutputs` table (Postgres)                                                 |
| Modify: `vibes.diy/api/sql/tables.ts`                      | Export new table                                                                       |
| Modify: `vibes.diy/api/svc/public/app-documents.ts`        | Build reduce from stored outputs, register host fns, store output after write          |
| Modify: `vibes.diy/api/svc/cf-serve.ts`                    | Pass db identity to invokeAccessFn                                                     |
| Modify: `vibes.diy/api/svc/types.ts`                       | Update invokeAccessFn type                                                             |
| Modify: `vibes.diy/pkg/workers/access-fn.ts`               | Accept reduce for host function registration                                           |
| Modify: `vibes.diy/api/svc/public/ensure-app-slug-item.ts` | Parse access.js exports, per-db binding rows                                           |
| Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`     | Update for new architecture                                                            |

---

### Task 1: Grant Reduce — Pure Logic Module

**Status: DONE** — `grant-reduce.ts` + 13 unit tests committed.

---

### Task 2: AccessFnOutputs Schema

Add the `AccessFnOutputs` table to both SQLite and Postgres schemas.

**Files:**

- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`
- Modify: `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`
- Modify: `vibes.diy/api/sql/tables.ts`

- [ ] **Step 1: Add SQLite table definition**

In `vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts`, add after the `sqlAccessFunctionBindings` table:

```typescript
export const sqlAccessFnOutputs = sqliteTable(
  "AccessFnOutputs",
  {
    userSlug: text().notNull(),
    appSlug: text().notNull(),
    dbName: text().notNull(),
    docId: text().notNull(),
    fnCid: text().notNull(),
    output: text().notNull(), // JSON-serialized AccessDescriptor
    hasGrants: integer().notNull(), // 1 if output has members/grant fields
  },
  (table) => [
    primaryKey({ columns: [table.userSlug, table.appSlug, table.dbName, table.docId] }),
    index("AccessFnOutputs_grants_idx").on(table.userSlug, table.appSlug, table.dbName, table.fnCid),
  ]
);
```

- [ ] **Step 2: Add Postgres table definition**

In `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts`, add after the `sqlAccessFunctionBindings` table:

```typescript
export const sqlAccessFnOutputs = pgTable(
  "AccessFnOutputs",
  {
    userSlug: text().notNull(),
    appSlug: text().notNull(),
    dbName: text().notNull(),
    docId: text().notNull(),
    fnCid: text().notNull(),
    output: text().notNull(),
    hasGrants: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userSlug, table.appSlug, table.dbName, table.docId] }),
    index("AccessFnOutputs_grants_idx").on(table.userSlug, table.appSlug, table.dbName, table.fnCid),
  ]
);
```

- [ ] **Step 3: Export from tables.ts**

In `vibes.diy/api/sql/tables.ts`, add `accessFnOutputs` to both the SQLite and Postgres table objects. Find where `accessFunctionBindings` is added and add `accessFnOutputs` next to it:

```typescript
// SQLite:
accessFnOutputs: sqlite.sqlAccessFnOutputs,

// Postgres:
accessFnOutputs: pg.sqlAccessFnOutputs,
```

- [ ] **Step 4: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts vibes.diy/api/sql/vibes-diy-api-schema-pg.ts vibes.diy/api/sql/tables.ts
git add vibes.diy/api/sql/vibes-diy-api-schema-sqlite.ts vibes.diy/api/sql/vibes-diy-api-schema-pg.ts vibes.diy/api/sql/tables.ts
git commit -m "feat(firefly): add AccessFnOutputs table to SQLite and Postgres schemas

Stores per-doc access function output keyed by fn CID. hasGrants flag
enables filtered index for efficient reduce queries."
```

---

### Task 3: Wire Reduce Into putDocEvento

The core wiring: build the reduce from stored outputs, pass it to the AccessFnDO for host function registration, and store the output after a successful write.

**Files:**

- Modify: `vibes.diy/api/svc/types.ts` (lines 77-83)
- Modify: `vibes.diy/api/svc/cf-serve.ts` (lines 281-300)
- Modify: `vibes.diy/api/svc/public/app-documents.ts` (lines 181-290)
- Modify: `vibes.diy/pkg/workers/access-fn.ts`

- [ ] **Step 1: Update invokeAccessFn type signature**

In `vibes.diy/api/svc/types.ts`, replace the existing `invokeAccessFn` (lines 77-83):

```typescript
  invokeAccessFn?(params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    grantState?: { members: Record<string, string[]>; roleGrants: Record<string, string[]>; userGrants: Record<string, string[]> };
  }): Promise<AccessDescriptor | { forbidden: string }>;
```

The `grantState` is a serializable snapshot of the reduce for the DO to use when registering host functions. This keeps the reduce computation in the caller (which has DB access) and sends the result to the DO (which has QuickJS).

- [ ] **Step 2: Update cf-serve.ts invokeAccessFn**

In `vibes.diy/api/svc/cf-serve.ts`, update the `invokeAccessFn` closure (lines 281-300). The DO key stays `params.cid` for now (source-hash keyed). Add `grantState` to the POST body:

```typescript
    invokeAccessFn: async (params): Promise<AccessDescriptor | { forbidden: string }> => {
      const id = env.ACCESS_FN_DO.idFromName(params.cid);
      const stub = env.ACCESS_FN_DO.get(id);
      const res = await stub.fetch(
        new Request("https://internal/invoke", {
          method: "POST",
          body: JSON.stringify({
            doc: params.doc,
            oldDoc: params.oldDoc,
            user: params.user,
            source: params.source,
            grantState: params.grantState,
          }),
          headers: { "Content-Type": "application/json" },
        }) as unknown as CFRequest
      );
      return res.json() as Promise<AccessDescriptor | { forbidden: string }>;
    },
```

- [ ] **Step 3: Update AccessFnDO to use grantState for host functions**

In `vibes.diy/pkg/workers/access-fn.ts`, update the DO to accept `grantState` in the POST body and register `ctx.requireAccess`/`ctx.requireRole` as host functions. Import `GrantReduce` and `extractContribution` from `@vibes.diy/api-svc`.

The key change: instead of `const ctx = ${JSON.stringify({})};`, register host functions:

```typescript
// Parse grantState from body
const grantState = body.grantState;

// Build GrantReduce from serialized state
const reduce = new GrantReduce();
if (grantState) {
  // Reconstruct from serialized maps
  for (const [role, slugs] of Object.entries(grantState.members ?? {})) {
    reduce.addDoc(`__member_${role}`, {
      members: new Map([[role, new Set(slugs as string[])]]),
      grantRoles: new Map(),
      grantUsers: new Map(),
      grantPublic: new Set(),
    });
  }
  for (const [role, channels] of Object.entries(grantState.roleGrants ?? {})) {
    reduce.addDoc(`__roleGrant_${role}`, {
      members: new Map(),
      grantRoles: new Map([[role, new Set(channels as string[])]]),
      grantUsers: new Map(),
      grantPublic: new Set(),
    });
  }
  for (const [slug, channels] of Object.entries(grantState.userGrants ?? {})) {
    reduce.addDoc(`__userGrant_${slug}`, {
      members: new Map(),
      grantRoles: new Map(),
      grantUsers: new Map([[slug, new Set(channels as string[])]]),
      grantPublic: new Set(),
    });
  }
}

// Register ctx with host functions
const ctxObj = vm.newObject();

const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle) => {
  const channelId = vm.dump(channelIdHandle) as string;
  if (!body.user) {
    return { error: vm.newError("authentication required") };
  }
  const channels = reduce.resolveEffectiveChannels(body.user.userHandle);
  if (!channels.has(channelId)) {
    return { error: vm.newError(`not in channel: ${channelId}`) };
  }
});

const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle) => {
  const roleName = vm.dump(roleNameHandle) as string;
  if (!body.user) {
    return { error: vm.newError("authentication required") };
  }
  if (!reduce.hasRole(body.user.userHandle, roleName)) {
    return { error: vm.newError(`not in role: ${roleName}`) };
  }
});

vm.setProp(ctxObj, "requireAccess", requireAccessFn);
vm.setProp(ctxObj, "requireRole", requireRoleFn);
vm.setProp(vm.global, "ctx", ctxObj);
requireAccessFn.dispose();
requireRoleFn.dispose();
ctxObj.dispose();
```

Remove the old `const ctx = ${JSON.stringify({})};` line.

- [ ] **Step 4: Update app-documents.ts — build reduce and store output**

In `vibes.diy/api/svc/public/app-documents.ts`, update the access function gate (around lines 181-290):

**Before invokeAccessFn** — build the reduce from stored outputs:

```typescript
      if (afbRow?.accessFnCid && vctx.invokeAccessFn) {
        // ... existing userContext and oldDoc resolution stays the same ...

        // Build reduce from stored outputs
        const tOutputs = vctx.sql.tables.accessFnOutputs;
        const storedOutputs = await vctx.sql.db
          .select({ docId: tOutputs.docId, output: tOutputs.output })
          .from(tOutputs)
          .where(
            and(
              eq(tOutputs.userSlug, req.ownerHandle),
              eq(tOutputs.appSlug, req.appSlug),
              eq(tOutputs.dbName, req.dbName),
              eq(tOutputs.fnCid, afbRow.accessFnCid),
              eq(tOutputs.hasGrants, 1)
            )
          );

        // Serialize reduce state for the DO
        const reduce = new GrantReduce();
        for (const row of storedOutputs) {
          const desc = JSON.parse(row.output) as AccessDescriptor;
          reduce.addDoc(row.docId, extractContribution(desc));
        }

        const grantState = {
          members: Object.fromEntries(
            Array.from(reduce.effectiveMembers).map(([k, v]) => [k, Array.from(v)])
          ),
          roleGrants: Object.fromEntries(
            Array.from(reduce.roleGrants).map(([k, v]) => [k, Array.from(v)])
          ),
          userGrants: Object.fromEntries(
            Array.from(reduce.userGrants).map(([k, v]) => [k, Array.from(v)])
          ),
        };

        // ... fetch source (existing code) ...

        const invokeResult = await vctx.invokeAccessFn({
          cid: afbRow.accessFnCid,
          doc: req.doc,
          oldDoc,
          user: userContext,
          source: accessFnSource,
          grantState,
        });
```

**After successful write** — store the access fn output:

After the doc is inserted and before the response is sent, store the output:

```typescript
// Store access fn output for future reduce queries
if (accessResult && !("forbidden" in accessResult)) {
  const outputHasGrants =
    (accessResult.members && Object.keys(accessResult.members).length > 0) ||
    (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
    (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
    (accessResult.grant?.public && accessResult.grant.public.length > 0)
      ? 1
      : 0;

  await vctx.sql.db
    .insert(tOutputs)
    .values({
      userSlug: req.ownerHandle,
      appSlug: req.appSlug,
      dbName: req.dbName,
      docId: req.docId ?? generatedDocId,
      fnCid: afbRow.accessFnCid,
      output: JSON.stringify(accessResult),
      hasGrants: outputHasGrants,
    })
    .onConflictDoUpdate({
      target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
      set: {
        fnCid: afbRow.accessFnCid,
        output: JSON.stringify(accessResult),
        hasGrants: outputHasGrants,
      },
    });
}
```

Add imports at the top of the file:

```typescript
import { GrantReduce, extractContribution } from "./grant-reduce.js";
```

- [ ] **Step 5: Remove the `"*"` wildcard fallback from the afbRow query**

Replace the `inArray(tAfb.dbName, [req.dbName, "*"])` with `eq(tAfb.dbName, req.dbName)`. Remove the `orderBy` clause.

- [ ] **Step 6: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write vibes.diy/api/svc/types.ts vibes.diy/api/svc/cf-serve.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/pkg/workers/access-fn.ts
git add vibes.diy/api/svc/types.ts vibes.diy/api/svc/cf-serve.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/pkg/workers/access-fn.ts
git commit -m "feat(firefly): wire grant reduce into putDocEvento write path

Build reduce from stored AccessFnOutputs, pass serialized grant state
to AccessFnDO for host function registration. Store access fn output
after successful write. requireAccess/requireRole now check real
channel/role membership."
```

---

### Task 4: Push-Time Export Parsing

Parse named exports from access.js and create per-db binding rows.

**Files:**

- Modify: `vibes.diy/api/svc/public/ensure-app-slug-item.ts`

- [ ] **Step 1: Define JS global names blocklist**

```typescript
const JS_PROTO_NAMES = new Set([
  "toString",
  "valueOf",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);
```

- [ ] **Step 2: Replace single-row upsert with export parsing**

Replace the existing access.js handling block (lines 137-171) with:

1. Read access.js source from storage
2. Parse with regex for `export function <name>` patterns
3. Filter through JS_PROTO_NAMES blocklist, reject `default`
4. Upsert one AccessFunctionBindings row per valid export name
5. Delete stale rows for exports that no longer exist
6. If no access.js in push, delete all binding rows for the app

See spec for full implementation. Key: use `notInArray` from drizzle-orm for stale row cleanup.

- [ ] **Step 3: Run fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/ensure-app-slug-item.ts
git add vibes.diy/api/svc/public/ensure-app-slug-item.ts
git commit -m "feat(firefly): parse access.js named exports at push time

Extracts named function exports, creates per-db AccessFunctionBindings
rows. Filters JS global names. Deletes stale rows on export removal."
```

---

### Task 5: Update Integration Tests

Update existing tests for the new architecture.

**Files:**

- Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`

- [ ] **Step 1: Update mock invokeAccessFn type**

The mock needs to accept the new `grantState` param. Update the `InvokeRecorder` and `setupCtx`:

```typescript
interface InvokeRecorder {
  calls: { cid: string; user: unknown; grantState?: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}
```

- [ ] **Step 2: Update seedBinding to use specific dbName**

The `seedBinding` call uses `dbName: "default"` — this is correct for the new architecture (no more `"*"` wildcard).

- [ ] **Step 3: Run tests**

```bash
cd vibes.diy/api/tests && npx vitest run access-fn-invoke.test.ts
```

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write vibes.diy/api/tests/access-fn-invoke.test.ts
git add vibes.diy/api/tests/access-fn-invoke.test.ts
git commit -m "test(firefly): update integration tests for grant reduce architecture

Mock invokeAccessFn accepts grantState param. Tests use exact dbName
instead of wildcard binding."
```

---

### Task 6: Full Check + Push

- [ ] **Step 1: Run pnpm fast-check**

```bash
cd /path/to/worktree && pnpm fast-check
```

- [ ] **Step 2: Review all commits**

```bash
git log --oneline -10
git diff origin/main...HEAD --stat
```

- [ ] **Step 3: Push**

```bash
git push
```
