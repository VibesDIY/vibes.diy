# Firefly Grant Reduce + Channel Enforcement — Design Spec

**Date:** 2026-05-31
**Status:** Draft
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

### access.js Convention

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

export function survey(doc, oldDoc, user, ctx) {
  return { allowAnonymous: true };
}
// databases with no matching export have no access function
```

Databases without a matching named export are unaffected — no access function runs, no DO is created, no hydration happens, no performance overhead.

### Export Name Safety

When parsing exports from access.js at push time, filter out JS built-in global object keys to avoid false positives. A database named `toString`, `constructor`, `valueOf`, etc. must not accidentally match a prototype method.

Allowlist approach: only register exports whose names are valid database names (the same validation used for `dbName` elsewhere in the system). If no explicit dbName validator exists, at minimum reject names that appear on `Object.prototype` (`toString`, `valueOf`, `constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__proto__`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`).

### Push-Time Export Parsing

`ensure-app-slug-item.ts` changes when `/access.js` is found:

1. Use QuickJS to evaluate the module source and extract named export names
2. Filter export names through the safety allowlist (reject JS globals)
3. For each valid export name: upsert `AccessFunctionBindings` row with `dbName = exportName`
4. Delete stale rows for this `(userSlug, appSlug)` where `dbName` is not in the current export set — handles renamed/removed exports
5. Store the full access.js source once (one CID/assetUri), referenced by all binding rows

The `dbName = "*"` wildcard convention from Phase 4 is removed. Existing `"*"` rows are migrated or ignored (they only exist on the PR branch, not in production).

### AccessFnDO Identity

Changes from source-hash key to per-database key:

- DO name: `${userSlug}/${appSlug}/${dbName}`
- Each DO instance holds the grant reduce for exactly one database
- `app-documents.ts` derives the DO ID from `(req.ownerHandle, req.appSlug, req.dbName)`
- No DO is created for databases without a binding row — the existing `if (afbRow?.accessFnCid)` gate handles this

### Zero Overhead for Unbound Databases

The access function path in `app-documents.ts` is gated by `afbRow?.accessFnCid`. Databases with no `AccessFunctionBindings` row skip the entire access function path — no DO lookup, no source fetch, no QuickJS, no hydration. This must remain true. The only cost is the existing SQL lookup on `AccessFunctionBindings`, which returns zero rows and short-circuits.

---

## Hydration Protocol

### Request Types

| Endpoint        | Body                                      | When                          |
| --------------- | ----------------------------------------- | ----------------------------- |
| `POST /invoke`  | `{ doc, oldDoc, user, source, dbName }`   | Every write                   |
| `POST /hydrate` | `{ docs: [{_id, data}], source, dbName }` | After `needsHydrate` response |

### Flow

1. `app-documents.ts` sends `POST /invoke` with the write payload
2. If DO has no reduce state → returns `{ needsHydrate: true }`
3. Caller fetches all current docs for `(ownerHandle, appSlug, dbName)` from the database
4. Caller sends `POST /hydrate` with the full doc set + source
5. DO uses `blockConcurrencyWhile` during hydration:
   - Runs the access function on every doc
   - Builds the grant reduce from scratch
   - Marks itself as hydrated
6. Queued `/invoke` requests unblock and proceed against the hydrated state

### Thundering Herd Protection

When the DO evicts and restarts, multiple concurrent writes may hit it. The first request gets `needsHydrate` and triggers hydration. `blockConcurrencyWhile` serializes all concurrent requests — they queue behind the hydration and proceed once the reduce is populated. Only one hydration runs; subsequent requests see the hydrated state.

---

## Grant Reduce

### In-Memory State

```
// Per-doc contribution (stored for incremental updates)
docContributions: Map<docId, DocContribution>

interface DocContribution {
  members:     Map<roleName, Set<userSlug>>     // from result.members
  grantRoles:  Map<roleName, Set<channelId>>    // from result.grant.roles
  grantUsers:  Map<userSlug, Set<channelId>>    // from result.grant.users
  grantPublic: Set<channelId>                   // from result.grant.public
}

// Reduced state (union across all docs)
effectiveMembers: Map<roleName, Set<userSlug>>
roleGrants:       Map<roleName, Set<channelId>>
userGrants:       Map<userSlug, Set<channelId>>
publicChannels:   Set<channelId>
```

### Incremental Update (per write)

1. If `docId` exists in `docContributions`, subtract its old contribution from the reduced state
2. Run access function on `(doc, oldDoc, user, ctx)` → get `AccessDescriptor`
3. Extract new `DocContribution` from the result
4. Add new contribution to reduced state (union into the Sets)
5. Store new contribution in `docContributions[docId]`
6. For deletes: subtract old contribution, remove from `docContributions`

### Subtraction

Subtracting a contribution is not a simple Set.delete — other docs may contribute the same grant. Correct subtraction requires re-scanning or reference counting.

**Approach: re-reduce on subtract.** When removing a doc's contribution:

1. Delete `docContributions[docId]`
2. Rebuild the reduced state from scratch by iterating `docContributions.values()`

This is O(total docs) but only happens on updates/deletes of docs whose previous AccessDescriptor included grant fields. Most writes (e.g., messages that only return `channels`) have no grant contribution and skip subtraction entirely. Only docs like channel-meta and membership trigger the re-reduce. If this becomes a bottleneck, reference counting can be added later without changing the API.

Alternative considered: reference counting per (role, slug) and (slug, channel) pair. More complex, harder to get right, premature optimization for the expected doc counts.

### Two-Pass Channel Resolution

```
effectiveChannels(userSlug) =
  userGrants[userSlug]                           // direct grants
  ∪ for each role where userSlug ∈ effectiveMembers[role]:
      roleGrants[role]                           // role-expanded grants
```

This is computed on-demand when `requireAccess(channelId)` is called, not pre-materialized. The Sets are small enough that iteration is fast.

---

## ctx Helpers as QuickJS Host Functions

The access function receives `ctx` with `requireAccess` and `requireRole` as callable functions inside the QuickJS VM. These are host functions registered via `vm.newFunction()` that call back into the DO's grant state.

### requireAccess(channelId)

1. If `user` is null → throw `"authentication required"`
2. Resolve `effectiveChannels(user.userHandle)`
3. If `channelId ∉ effectiveChannels` → throw `"not in channel: ${channelId}"`
4. Otherwise return (no-op, write is allowed)

### requireRole(roleName)

1. If `user` is null → throw `"authentication required"`
2. If `user.userHandle ∉ effectiveMembers[roleName]` → throw `"not in role: ${roleName}`
3. Otherwise return (no-op, write is allowed)

### Registration

```typescript
const ctxObj = vm.newObject();

const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle) => {
  const channelId = vm.dump(channelIdHandle);
  if (!userContext) {
    return { error: vm.newError("authentication required") };
  }
  const channels = resolveEffectiveChannels(userContext.userHandle);
  if (!channels.has(channelId)) {
    return { error: vm.newError(`not in channel: ${channelId}`) };
  }
});

const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle) => {
  const roleName = vm.dump(roleNameHandle);
  if (!userContext) {
    return { error: vm.newError("authentication required") };
  }
  if (!effectiveMembers.get(roleName)?.has(userContext.userHandle)) {
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

Host function errors become QuickJS exceptions → caught as `fnResult.error` → returned as `{ forbidden: "..." }` to the caller.

---

## Source Extraction at Push Time

Since the DO receives a single function (not the full module), `ensure-app-slug-item.ts` must extract the function body for each named export.

**Approach:** Use QuickJS at push time to evaluate the module and serialize each export:

1. Evaluate the full `access.js` source in a QuickJS VM
2. For each named export, extract its function via `vm.evalCode('typeof exportName === "function" ? exportName.toString() : null')`
3. `Function.toString()` returns the full function declaration (e.g., `function chat(doc, oldDoc, user, ctx) { ... }`) — store this as the source for that binding
4. The DO receives a self-contained function string, not the full module

The DO's evaluation model changes slightly: instead of wrapping a function body in an IIFE, it evaluates the full function declaration and then calls it: `${source}\n${dbName}(doc, oldDoc, user, ctx)`. This is a minor change from the current IIFE pattern.

### When access.js is Deleted

If a push no longer includes `/access.js`, `ensure-app-slug-item.ts` must delete all `AccessFunctionBindings` rows for that `(userSlug, appSlug)`. This disables access function enforcement for all databases in the app — writes revert to the pre-access-function behavior (authenticated-only, no channel isolation).

---

## Changes Required

| File                                      | Change                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pkg/workers/access-fn.ts`                | Add instance state (reduce maps, `hydrated` flag), `/hydrate` endpoint, `blockConcurrencyWhile`, host function registration for `requireAccess`/`requireRole`, incremental reduce update |
| `api/svc/public/ensure-app-slug-item.ts`  | Parse access.js exports via QuickJS, filter JS globals, create per-db binding rows, delete stale rows                                                                                    |
| `api/svc/public/app-documents.ts`         | Change DO key from source hash to `${ownerHandle}/${appSlug}/${dbName}`, handle `needsHydrate` response → fetch all docs → send `/hydrate`                                               |
| `api/types/access-function.ts`            | No changes (types already cover full AccessDescriptor)                                                                                                                                   |
| `api/svc/public/access-function.ts`       | No changes (makeHelpers stays for Node test parity)                                                                                                                                      |
| New: `api/tests/access-fn-reduce.test.ts` | Unit tests for reduce logic: union, subtract/rebuild, two-pass channel resolution                                                                                                        |
| `api/tests/access-fn-unit.test.ts`        | Add host function tests for requireAccess/requireRole                                                                                                                                    |
| `api/tests/access-fn-invoke.test.ts`      | Update for hydration protocol, per-db DO identity                                                                                                                                        |

---

## Tests

### Reduce Logic (unit, no CF runtime)

1. **Union**: two docs contributing grants to same channel → user has access
2. **Subtract/rebuild**: delete one doc → re-reduce → user loses that doc's grants but keeps the other's
3. **Two-pass expansion**: role-channels doc + membership doc → user gets channels via role
4. **Role removal**: delete membership doc → user loses role-expanded channels
5. **Direct + role overlap**: user has both direct grant and role-expanded grant to same channel → removing one doesn't remove the other
6. **Empty reduce**: no docs → no grants → requireAccess always throws

### Host Functions (unit, QuickJS)

1. `requireAccess` passes when user has channel grant
2. `requireAccess` throws when user lacks channel grant
3. `requireAccess` throws when user is null
4. `requireRole` passes when user is in role
5. `requireRole` throws when user is not in role
6. `requireRole` throws when user is null

### Integration (mock DO)

1. First invoke returns `needsHydrate`
2. Hydrate with doc set → subsequent invokes work
3. Concurrent invokes during hydration queue and resolve
4. Write updates reduce incrementally
5. Delete removes doc contribution from reduce

### Export Parsing (unit)

1. Named exports extracted correctly
2. `export default` ignored
3. JS global names (`toString`, `constructor`) filtered out
4. Non-function exports ignored
5. Empty access.js → no binding rows
6. Removed export → stale binding row deleted
