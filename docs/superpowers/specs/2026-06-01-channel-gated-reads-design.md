# Channel-Gated Reads — Design Spec

**Date:** 2026-06-01
**Status:** Draft
**Depends on:** PR #2090 (grant reduce + AccessFnOutputs)

---

## Problem

The access function system gates writes (requireAccess/requireRole can reject), but reads are unfiltered — queryDocs and getDoc return every document in the database regardless of channel membership. Without read filtering, channels don't actually isolate data.

## Goal

When a database has an access function binding, filter queryDocs and getDoc results to only return documents the requesting user has channel access to. Databases without access functions keep current behavior (all docs visible).

## Non-Goals

- Write-path changes (already handled by Phase 3)
- Subscription/live-query filtering (separate work — uses the same channel check but applied to the push path)
- Channel-aware pagination

---

## Architecture

### DocChannels View

A database-level view that extracts per-doc channel assignments from the `AccessFnOutputs` table. Always current — no application-level sync needed.

**Postgres/Neon:**

```sql
CREATE VIEW "DocChannels" AS
SELECT "userHandle", "appSlug", "dbName", "docId",
       jsonb_array_elements_text("output"::jsonb->'channels') AS "channelId"
FROM "AccessFnOutputs";
```

**SQLite/D1 (dev shim):**

```sql
CREATE VIEW DocChannels AS
SELECT userHandle, appSlug, dbName, docId, value AS channelId
FROM AccessFnOutputs, json_each(json_extract(output, '$.channels'));
```

The view is created via raw SQL migration, not Drizzle schema. Queries use raw SQL JOINs.

### Read Path — queryDocs

Current flow (unchanged):

1. ACL check (database-level access)
2. Fetch all rows for `(ownerHandle, appSlug, dbName)`
3. Deduplicate to latest per docId
4. Skip deleted
5. Apply optional predicate filter
6. Return docs

New step inserted after step 3 (deduplicate), before step 4 (skip deleted):

3a. **If access function binding exists for this database:**

- Build the grant reduce from `AccessFnOutputs WHERE hasGrants = 1 AND fnCid = ?`
- Resolve the requesting user's effective channels (two-pass: direct + role-expanded)
- Also collect `publicChannels` from the reduce
- Filter docs: keep only docs that appear in `DocChannels` view with a `channelId` that is in the user's effective channels OR in publicChannels
- Docs with no entry in DocChannels (no channels field in their output) are not visible

3b. **If no access function binding:** skip filtering (current behavior)

### Read Path — getDoc

Same channel check applied to single-doc fetch. After the existing ACL check and before returning the doc:

1. If access function binding exists → build reduce → resolve user's channels
2. Check if the doc appears in DocChannels with a channelId in the user's effective channels or publicChannels
3. If not → return `not-found` (don't leak existence)

### Grant Reduce on Read

The read path builds the same reduce as the write path:

```
1. Query AccessFnOutputs WHERE (userHandle, appSlug, dbName, fnCid) AND hasGrants = 1
2. For each row: extractContribution(JSON.parse(output))
3. Accumulate into GrantReduce
4. resolveEffectiveChannels(userHandle) → Set<channelId>
5. publicChannels from the reduce → Set<channelId>
```

The GrantReduce module is already implemented and tested (13 unit tests).

### Public Channels (grant.public)

Docs routed to a channel listed in `grant.public` are readable by anyone, including unauthenticated users. The read filter checks: does any of the doc's channels appear in the user's effective channels OR in publicChannels?

For anonymous readers (no user context), only publicChannels apply — effectiveChannels is empty.

### Default Visibility Rules

| Condition                                                                       | Docs visible?               |
| ------------------------------------------------------------------------------- | --------------------------- |
| No access fn binding for db                                                     | All docs (current behavior) |
| Access fn exists, doc has channels, user has access                             | Yes                         |
| Access fn exists, doc has channels, user lacks access                           | No                          |
| Access fn exists, doc has no channels in output                                 | No                          |
| Access fn exists, doc's channel is in grant.public                              | Yes (even anonymous)        |
| Access fn exists, no stored output for doc (written before access fn was added) | No                          |

### Performance

The DocChannels view is a derived view — no storage overhead. The JOIN filters docs efficiently. The grant reduce query (`hasGrants = 1`) scans only grant-contributing docs (typically tens, not thousands).

For queryDocs, there are two approaches to the filtering:

**Option A — SQL JOIN:** Join AppDocuments against DocChannels in the query itself, filtering at the SQL level. Most efficient but requires raw SQL (Drizzle doesn't support view JOINs natively).

**Option B — JS filter after fetch:** Fetch all docs (current behavior), then filter in JS using the DocChannels data. Simpler to implement, wastes bandwidth for filtered-out docs.

**Chosen approach: Option B** — fetch all, filter in JS. The current queryDocs already fetches all rows and deduplicates in JS. Adding a JS filter step is minimal change. SQL JOIN optimization can be added later if bandwidth becomes an issue.

---

## Changes Required

| File                                            | Change                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| New: migration SQL                              | Create DocChannels view (Postgres + SQLite)            |
| Modify: `api/svc/public/app-documents.ts`       | Add channel filter to queryDocsEvento and getDocEvento |
| New: `api/tests/access-fn-channel-read.test.ts` | Integration tests for channel-gated reads              |

---

## Tests

### Channel-Gated queryDocs

1. **No access fn binding** → all docs returned (current behavior)
2. **Access fn exists, user has channel access** → only docs in accessible channels returned
3. **Access fn exists, user lacks channel access** → docs in inaccessible channels excluded
4. **Public channel** → docs in grant.public channels visible to everyone including anonymous
5. **Doc with no channels in output** → not visible when access fn exists

### Channel-Gated getDoc

1. **Doc in user's channel** → returned normally
2. **Doc not in user's channel** → returns not-found
3. **Doc in public channel** → returned to anonymous reader
4. **No access fn binding** → returned normally (current behavior)
