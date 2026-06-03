# Firefly Grant Reduce + Channel Enforcement — Design Spec

**Date:** 2026-05-31
**Status:** Draft (v2 — simplified, no separate DO)
**Depends on:** PR #2089 (invokeAccessFn + QuickJS WASM)

---

## Problem

The access function system (PR #2089) evaluates user-supplied JS on every write, but `ctx.requireAccess(channelId)` and `ctx.requireRole(roleName)` are stubs that only check `user !== null`. The spec defines a grant reduce model where channel membership is derived from the union of all access function outputs across the current document set. Without the reduce, there's no channel isolation — any authenticated user passes both helpers.

## Goal

Implement the full grant reduce: materialize channel and role memberships from access function outputs, make `requireAccess` and `requireRole` check the materialized state, and support per-database access function binding via named exports in `access.js`.

## Non-Goals

- Read-path channel filtering (queryDocs returning only docs the user has channel access to) — separate work
- Expiry field enforcement
- `grant.public` read enforcement (requires query-path changes)
- Per-database access functions via separate files (access-chat.js, etc.) — named exports cover this

---

## Architecture

### Core Principle: Output Stored With the Doc

Each document's access function output (AccessDescriptor) is stored alongside the document, keyed by the access function CID that produced it. The grant reduce is computed on demand from these stored outputs — no separate stateful DO, no hydration protocol, no thundering herd concern.

When the access function source changes (new push → new CID), all old outputs are automatically stale (keyed by the old CID). New writes produce outputs under the new CID; the reduce starts fresh.

### Write Path (putDocEvento)

1. Look up `AccessFunctionBindings` → get `accessFnCid` + source for this `(ownerHandle, appSlug, dbName)`
2. Query all stored outputs for this `(ownerHandle, appSlug, dbName, accessFnCid)` that have grant contributions
3. Reduce them → build effective channels/roles
4. Evaluate access fn in QuickJS with `ctx.requireAccess`/`ctx.requireRole` checking the reduce
5. If `enforceAllowAnonymous` passes and access fn didn't throw → write accepted
6. Store the new doc's AccessDescriptor output alongside the doc (keyed by `accessFnCid`)
7. On delete: remove the stored output for that doc

### Schema

New table `AccessFnOutputs`:

```sql
CREATE TABLE AccessFnOutputs (
  userHandle   TEXT NOT NULL,
  appSlug    TEXT NOT NULL,
  dbName     TEXT NOT NULL,
  docId      TEXT NOT NULL,
  fnCid      TEXT NOT NULL,    -- which access fn version produced this
  output     TEXT NOT NULL,    -- JSON-serialized AccessDescriptor
  hasGrants  INTEGER NOT NULL, -- 1 if output has members/grant fields, 0 otherwise
  PRIMARY KEY (userHandle, appSlug, dbName, docId)
);
CREATE INDEX AccessFnOutputs_grants_idx
  ON AccessFnOutputs (userHandle, appSlug, dbName, fnCid)
  WHERE hasGrants = 1;
```

The `hasGrants` flag enables efficient filtering: most docs (messages, regular data) return `{ channels: [...] }` with no grant fields. Only channel-meta and membership docs have grants. The reduce query only scans `hasGrants = 1` rows.

The primary key is `(userHandle, appSlug, dbName, docId)` — one output per doc, upserted on each write. When the access fn CID changes, old rows persist with the old `fnCid` but the reduce query filters by current CID, so they're effectively stale. A cleanup job can delete old-CID rows lazily.

### No Separate DO for State

The previous design (v1) used a separate AccessFnDO with in-memory reduce state, a hydration protocol, and `blockConcurrencyWhile` for thundering herd protection. This is eliminated. The AccessFnDO still exists for QuickJS evaluation (it's already deployed), but it no longer holds reduce state. The reduce is computed from the `AccessFnOutputs` table on each write.

Alternatively, QuickJS evaluation can move inline into putDocEvento if it works in Worker fetch handlers (not just DO fetch handlers). If not, the AccessFnDO remains a thin eval wrapper with no state.

### Zero Overhead for Unbound Databases

Databases with no `AccessFunctionBindings` row skip the entire access function path — no QuickJS, no output query, no reduce. The only cost is the existing SQL lookup on `AccessFunctionBindings`, which returns zero rows and short-circuits.

---

## access.js Convention

Named exports only. Export name = database name. No `export default`.

```js
// access.js — workplace chat app
export function chat(doc, oldDoc, user, ctx) {
  if (doc.type === "channel-meta") {
    return {
      channels: [doc._id],
      grant: { users: Object.fromEntries([...doc.memberSlugs, doc.ownerSlug].map((s) => [s, [doc._id]])) },
    };
  }
  if (doc.type === "message") {
    ctx.requireAccess(doc.channelId);
    return { channels: [doc.channelId] };
  }
}
```

Databases without a matching named export are unaffected — no access function runs, no performance overhead.

### Export Name Safety

Filter out JS built-in global object keys when parsing exports at push time. Reject names on `Object.prototype` (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__proto__`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`).

### Push-Time Export Parsing

`ensure-app-slug-item.ts` changes when `/access.js` is found:

1. Use QuickJS to evaluate the module source and extract named export names
2. Filter export names through the safety blocklist (reject JS globals)
3. For each valid export name: upsert `AccessFunctionBindings` row with `dbName = exportName`
4. Delete stale rows for this `(userHandle, appSlug)` where `dbName` is not in the current export set
5. Store the full access.js source once (one CID/assetUri), referenced by all binding rows

When access.js is deleted from a push, delete all `AccessFunctionBindings` rows for that app.

---

## Grant Reduce

### Reduce Logic (pure module)

The `GrantReduce` class and `extractContribution` function are pure logic with no runtime dependencies. They accumulate contributions from AccessDescriptor outputs and resolve effective channel/role memberships.

```
effectiveChannels(userHandle) =
  userGrants[userHandle]                           // direct grants
  ∪ for each role where userHandle ∈ effectiveMembers[role]:
      roleGrants[role]                           // role-expanded grants
```

### On-Demand Reduce During Write

On each write, the reduce is computed by:

1. Query `AccessFnOutputs WHERE (userHandle, appSlug, dbName, fnCid) AND hasGrants = 1`
2. For each row, `extractContribution(JSON.parse(output))` → `DocContribution`
3. Accumulate into a fresh `GrantReduce` instance
4. Use `resolveEffectiveChannels` and `hasRole` for the current write's checks

For most apps, the number of grant-contributing docs is small (channel-meta, membership docs — tens, not thousands). The per-write scan cost is acceptable.

---

## ctx Helpers as QuickJS Host Functions

The access function receives `ctx` with `requireAccess` and `requireRole` as callable functions inside the QuickJS VM. These are host functions registered via `vm.newFunction()` that check the reduce built from stored outputs.

### requireAccess(channelId)

1. If `user` is null → throw `"authentication required"`
2. Resolve `effectiveChannels(user.userHandle)` from the reduce
3. If `channelId ∉ effectiveChannels` → throw `"not in channel: ${channelId}"`

### requireRole(roleName)

1. If `user` is null → throw `"authentication required"`
2. If `user.userHandle ∉ effectiveMembers[roleName]` → throw `"not in role: ${roleName}`

---

## Changes Required

| File                                             | Change                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| New: `api/svc/public/grant-reduce.ts`            | Pure reduce logic (already implemented)                                                    |
| New: `api/sql/vibes-diy-api-schema-*.ts`         | Add `AccessFnOutputs` table to both SQLite and Postgres schemas                            |
| Modify: `api/svc/public/app-documents.ts`        | Build reduce from stored outputs, pass to QuickJS host functions, store output after write |
| Modify: `api/svc/public/ensure-app-slug-item.ts` | Parse access.js exports, per-db binding rows                                               |
| Modify: `api/svc/cf-serve.ts`                    | Update invokeAccessFn params                                                               |
| Modify: `api/svc/types.ts`                       | Update invokeAccessFn type                                                                 |
| Modify: `pkg/workers/access-fn.ts`               | Accept reduce state for host function registration (or move QuickJS eval inline)           |

---

## Tests

### Reduce Logic (unit — already done)

1. Union, subtract/rebuild, two-pass expansion, role removal, overlap, empty reduce

### Output Storage (integration)

1. Write doc → AccessFnOutputs row created with correct fnCid and output
2. Delete doc → AccessFnOutputs row removed
3. Update doc → AccessFnOutputs row updated
4. Access fn CID change → old outputs ignored in reduce (filtered by current fnCid)

### Channel Enforcement (integration)

1. requireAccess passes when user has channel grant (via stored output)
2. requireAccess rejects when user lacks channel grant
3. requireRole passes/rejects based on stored member outputs
4. Zero overhead for database with no access fn binding

### Export Parsing (unit)

1. Named exports extracted correctly
2. `export default` ignored
3. JS global names filtered out
4. Non-function exports ignored
5. Removed export → stale binding row deleted
