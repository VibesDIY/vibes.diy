# Backfill AccessFnOutputs on access.js Push — Design

**Issue:** #2101
**Date:** 2026-06-01

## Problem

When access.js is pushed for the first time (or updated), existing documents have no `AccessFnOutputs` rows. With channel-gated reads (#2098), those docs become invisible — they can't be queried or fetched until each is individually re-saved through the access function gate.

## Solution

Inline backfill in `ensureAppSlugItem`. After the AccessFunctionBindings upsert loop, detect which bindings have new or changed CIDs. For each changed binding, query all existing docs, invoke the access function on each, and upsert the results into AccessFnOutputs.

Inline (blocking) rather than async because:

- The push already does heavy work (LLM metadata derivation, chat seeding)
- QuickJS WASM eval is ~1ms/doc — even 500 docs adds < 1 second
- Guarantees channel-gated reads work immediately after push (no race window)

## Data Flow

```
ensureAppSlugItem receives push with /access.js
  → extract export names → upsert bindings (existing code)
  → query old bindings beforehand to detect CID changes
  → for each dbName where CID is new or changed:
      1. fetch access fn source from storage (once, reuse across docs)
      2. query latest AppDocuments for (ownerHandle, appSlug, dbName)
      3. for each non-deleted doc:
           invokeAccessFn({ cid, doc, oldDoc: null, user: null, source, grantState: {} })
           → upsert AccessFnOutputs (same pattern as putDocEvento)
           → skip + log on forbidden / error
```

## Key Decisions

### CID change detection

Query existing bindings for this (ownerHandle, appSlug) before the upsert loop. Build a `Map<dbName, oldCid>`. After upserts, compare per-dbName — only backfill where CID is new or changed. Avoids redundant work on idempotent re-pushes of the same access.js.

### grantState

Empty `{ members: {}, roleGrants: {}, userGrants: {} }`. Channels (the primary use case) don't depend on grants. Grant-dependent access control can be addressed later with a two-pass approach if needed.

### user context

`null` — backfill runs in system context, not on behalf of a writer. Access functions that require authenticated users will return `forbidden`, and those docs get skipped. This is correct: docs requiring auth to evaluate won't have outputs until an authenticated user re-saves them.

### oldDoc

`null` — we're evaluating current document state, not a write delta. Access functions that rely on oldDoc for update-ownership checks will see this as a "new document" evaluation.

### Error handling

`exception2Result` per doc. Log failures, don't fail the push. A single doc's access fn failure shouldn't block the entire push or other docs' backfill.

### Guard

Only runs if `vctx.invokeAccessFn` is defined (optional on `VibesApiSQLCtx`). In tests without a mock invoker, backfill is skipped.

### Querying latest doc versions

Follow the same pattern as `queryDocsEvento`: query all rows ordered by `(docId, seq)`, last row per docId wins, skip deleted. Dedup in JS.

## Schema (existing, no changes needed)

### AccessFunctionBindings

```
PK: (userHandle, appSlug, dbName)
Columns: accessFnCid, accessFnAssetUri, updated
```

### AccessFnOutputs

```
PK: (userHandle, appSlug, dbName, docId)
Columns: fnCid, output (JSON), hasGrants (0|1)
Index: (userHandle, appSlug, dbName, fnCid) for grant queries
```

### AppDocuments

```
PK: (ownerHandle[=userHandle], appSlug, dbName, docId, seq)
Columns: userId, data (JSON), deleted (0|1), created
```

## Files Changed

| File                                                   | Change                                 |
| ------------------------------------------------------ | -------------------------------------- |
| `vibes.diy/api/svc/public/ensure-app-slug-item.ts`     | Add backfill after binding upsert loop |
| `vibes.diy/api/tests/access-fn-backfill.test.ts` (new) | Integration tests                      |

## Test Plan

1. Create app, write docs to database `chat`
2. Push access.js with `export function chat(doc) { return { channels: ['general'] }; }`
3. Assert AccessFnOutputs rows exist for all docs with correct fnCid and channels
4. Re-push same access.js (same CID) — assert no redundant invokeAccessFn calls
5. Push updated access.js (new CID) — assert outputs updated with new fnCid
6. Doc where access fn returns forbidden — assert no AccessFnOutputs row, other docs still backfilled

## Out of Scope

- Async/queue-based backfill for large doc sets (future optimization)
- Two-pass backfill for grant-dependent access functions
- Batching or pagination for apps with 10k+ docs
- Multi-export function routing bug (the DO currently calls the first export regardless of dbName)
