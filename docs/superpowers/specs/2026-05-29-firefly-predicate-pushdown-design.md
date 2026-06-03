# Firefly Predicate Pushdown — Design Spec

**Date:** 2026-05-29
**Status:** Approved
**Approach:** A — server-side JS filter after deduplication (Phase 1)

---

## Problem

`FireflyDatabase.query()` calls `queryDocs(dbName)` which fetches every document for the
app from Postgres, sends the full payload over the wire, and filters entirely on the
client. For apps with many documents this wastes bandwidth and client CPU on every
`useLiveQuery` subscription refresh.

## Goal

For the simplest `useLiveQuery` call shape — string field name plus a key, keys, or range
option — push the filter to the server so only matching docs travel the wire. All other
call shapes fall back to the existing full-scan path unchanged.

## Non-Goals

- SQL-level Postgres pushdown (deferred to Phase 2 / Approach C)
- JSONB index creation
- Filtering on function mapFns
- Prefix pushdown (not needed in current Firefly usage)

---

## Architecture

### Trigger condition (client)

```
typeof mapFn === 'string'  AND  (opts.key | opts.keys | opts.range) is set
```

When true, `FireflyDatabase.query()` builds a `QueryHint` and passes it to
`queryDocs`. Otherwise `hint` is `undefined` and the call is identical to today.

### Wire change

`ReqQueryDocs` gains an optional `filter` field:

```ts
filter?: {
  field: string;          // doc field name (same as the string mapFn)
  key?: unknown;          // exact match
  keys?: unknown[];       // set match
  range?: [unknown, unknown]; // inclusive range
}
```

Only one of `key`, `keys`, or `range` will be set per request.

### Server handler change (`queryDocsEvento`)

Existing flow (unchanged):

1. Fetch all revisions for `(userHandle, appSlug, dbName)`
2. JS-deduplicate to latest revision per `docId`
3. Exclude deleted docs
4. Mint file URLs

New step inserted after step 4, before serialising: 5. If `req.filter` is present, filter docs in JS using native JS value comparison on the
raw JSONB field value — strict equality for `key`, `Set.has` for `keys`, `>=`/`<=` for
`range`. No charwise encoding: the server works with native JSON types, not the
client's sort-encoded strings.

The client-side filter in `FireflyDatabase.query()` remains as a correctness safety net
(it becomes a no-op on the fast path; it still runs on the fallback path).

### Call chain

```
useLiveQuery('status', { key: 'active' })
  FireflyDatabase.query('status', { key: 'active', includeDocs: true })
    hint = { field: 'status', key: 'active' }
    → FireflyTransport.queryDocs(dbName, hint)
      → FireflyApiAdapter.queryDocs(dbName, hint)
        → VibesDiyApi.queryDocs({ userHandle, appSlug, dbName, filter: hint })
          → handler: fetch → dedup → filter(hint) → return subset
```

---

## Changes Required

| File                               | Change                                                       |
| ---------------------------------- | ------------------------------------------------------------ |
| `api/types/app-documents.ts`       | Add optional `filter` to `reqQueryDocs` arktype schema       |
| `api/svc/public/app-documents.ts`  | Apply JS filter after dedup in `queryDocsEvento`             |
| `vibe/runtime/firefly-database.ts` | Update `FireflyTransport` interface; build hint in `query()` |
| `api/impl/firefly-api-adapter.ts`  | Thread hint through to API call                              |
| `pkg/test/`                        | New test file for predicate pushdown                         |

---

## Tests

Tests are written to survive the Phase 2 migration to SQL-level filtering (Approach C).
They assert on _observable behaviour_, not on whether filtering happens in SQL or JS.

**Test cases:**

| Case              | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `key` match       | Returns only docs where `field === value`; other docs absent        |
| `keys` match      | Returns docs where field value is in the provided set               |
| `range` match     | Returns docs where field value is within `[lo, hi]` inclusive       |
| No filter         | All non-deleted docs returned (baseline regression)                 |
| Dedup correctness | Latest revision wins; earlier revision value does not bleed through |
| Deleted exclusion | Doc with matching field but `deleted=1` is excluded                 |
| Function mapFn    | No hint sent; full set returned; client-side filter applied         |
| Unknown field     | Docs that lack the field are excluded from results                  |

Test location: `vibes.diy/pkg/test/` using existing `createVibeDiyTestCtx` infrastructure.

---

## Phase 2 Path (Approach C)

When a GIN index on `data` exists, the server handler can replace the JS filter with:

```sql
WHERE data->>'field' = $value          -- key
WHERE data->>'field' = ANY($values)    -- keys
WHERE data->>'field' BETWEEN $lo $hi   -- range (string fields)
```

Because deduplication currently happens in JS after a full-row fetch, Phase 2 will need
to restructure the query (CTE to select max-seq per docId first, then filter) or accept
that the JS dedup still runs on the post-SQL result set. The test suite from Phase 1
provides the regression baseline for that migration.
