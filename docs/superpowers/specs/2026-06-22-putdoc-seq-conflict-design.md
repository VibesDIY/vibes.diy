# putDoc seq-collision fix — retry-with-next-seq (LWW), storm-resistant

**Issue:** [VibesDIY/vibes.diy#2506](https://github.com/VibesDIY/vibes.diy/issues/2506)
**Date:** 2026-06-22
**Scope:** server-side only (no API-shape change, no schema migration)

## Problem

Concurrent `putDoc` writes to the same `(ownerHandle, appSlug, dbName, docId)`
can hard-fail with an opaque `Failed query: insert into "AppDocuments" (…)`.
The write handler allocates the per-doc `seq` with a non-atomic
read-modify-write and then does a plain `INSERT` with no conflict handling
(`vibes.diy/api/svc/public/app-documents-write-eventos.ts:362-380`):

```ts
const maxSeqResult = await db.select({ maxSeq: max(t.seq) }).where(/* owner, app, db, docId */);
const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;   // read-modify...
await db.insert(t).values({ ... seq: nextSeq ... }); // ...write, plain insert, no onConflict
```

Two overlapping writers both read `max = N`, both compute `N+1`, both insert
`seq = N+1`; the first wins, the second violates the PK
(`vibes-diy-api-schema-pg.ts:251`) and throws an uncaught rejection.

Surfaced from `garden-gnome/rainy-vinyl-vibes`: sliders wrote on every
`onChange`, flooding one shared doc (`mix:current`); the racing inserts
collided. App-side fix shipped; this issue is the platform behavior.

## Decided semantics

- **Default = retry-with-next-seq (last-write-wins at the log level).** Both
  writes persist as distinct revisions; `max(seq)` is the winner. No lost
  writes (history retains both), no client errors on a self-race. Matches the
  CRDT / "no loading or error states" framing authors are given (#2501).
- **No API-shape change now.** The opt-in `failOnConflict` / expected-base
  mode (option 3 in the issue) is deferred. This change is internal to the
  write handler.
- **The truly-smooth schema redesign is deferred to a follow-up issue** (see
  below) because it needs a migration and touches the read path.

## Why a naive retry is not enough: backend analysis

The service runs **two** backends, selected by `DB_FLAVOUR`
(`vibes.diy/api/sql/index.ts:13-26`): Neon **Postgres** or Cloudflare **D1
(SQLite)**. Neither path holds a transaction across `SELECT max` → `INSERT`,
so both race today.

- **D1 / SQLite:** all writes are globally serialized by SQLite's single
  write lock. The race exists _only_ because the read and the write are two
  separate round-trips.
- **Neon Postgres (READ COMMITTED):** a naive "on PK conflict, re-read max,
  bump, re-insert" loop **storms** under a burst. N near-simultaneous writes
  to one doc all read `max = N₀`, all try `N₀+1`; winner commits, the other
  N−1 retry, collide again on `N₀+2`, etc. → worst case **O(N²)** inserts for
  a burst of N. The slider drag is exactly such a burst.

So retry-with-next-seq must be written carefully, not naively.

## Design

Three layers inside the write handler, no schema migration.

### 1. Atomic seq allocation: single-statement `INSERT … SELECT MAX+1`

Replace the `SELECT max` + `INSERT` pair with one statement:

```sql
INSERT INTO "AppDocuments" (userSlug, appSlug, dbName, docId, seq, userId, data, deleted, created)
SELECT $owner, $app, $db, $docId,
       COALESCE(MAX(seq), 0) + 1,
       $userId, $data, 0, $now
FROM "AppDocuments"
WHERE userSlug = $owner AND appSlug = $app AND dbName = $db AND docId = $docId
```

(Identical statement shape works on both SQLite and Postgres; emitted via
drizzle's `sql` template.)

- **D1 / SQLite:** runs entirely under the write lock, so `MAX(seq)` always
  sees every committed row → **distinct seq every time, zero collisions, zero
  retries, zero storm.** The slider/self-race case is simply fixed.
- **Postgres:** halves round-trips and shrinks the window, but two concurrent
  `INSERT … SELECT` can still read the same `MAX` (the uncommitted row is
  invisible), so layer 2 is required there.

We need `nextSeq` after the insert (it feeds `lastSeenSeq`, the
`nextSeq === 1` comments path, and `notifyDocChanged`). Recover it with a
**uniform follow-up `SELECT MAX(seq)`** read — the same drizzle read on every
backend, no `RETURNING` and no backend-specific raw-result parsing. `RETURNING`
is fully supported on all backends, but pairing it with a raw `INSERT … SELECT`
loses drizzle's typed result and forces per-driver parsing (D1 `ResultSet` vs
libsql vs neon), so it is not worth the branching. The recovery read can itself
momentarily lag a concurrent writer, but `nextSeq` is only used for downstream
signals (the `lastSeenSeq` upsert already does `MAX(...)`, the `=== 1` comments
trigger, the change notification); a slightly-stale value there is harmless and
never corrupts the append-only log.

### 2. Postgres-only per-doc serialization: `pg_advisory_xact_lock`

When `flavour === "pg"`, take a transaction-scoped advisory lock keyed on a
hash of `(owner, app, db, docId)` at the start of the write, inside a
transaction wrapping the insert:

```sql
SELECT pg_advisory_xact_lock(hashtextextended($key, 0))
```

Same-doc writers queue on the lock instead of colliding → **O(N), not
O(N²)**, no wasted retries. Different docs never contend (lock keyed per doc).
The lock auto-releases at transaction end. SQLite needs nothing — it already
serializes writes — so this branch is skipped for `sqlite`.

### 3. Bounded retry + typed conflict error (belt-and-suspenders)

Wrap the insert in a bounded retry (≤3 attempts) that catches a PK-uniqueness
violation, re-runs the atomic `INSERT … SELECT MAX+1`, and on final exhaustion
returns a **typed** `ResError` with `code: "conflict"` instead of leaking the
raw `Failed query: insert…` string. With layers 1+2 this path should
essentially never be hit, but it guarantees we never surface a raw SQL error.

### Threading the flavour

`DBFlavour` is known at handler construction (`create-handler.ts:248`) but is
not currently on `vctx.sql`. Add `flavour: DBFlavour` to the `sql` object in
`VibesApiSQLCtx` (`vibes.diy/api/svc/types.ts:29-32`) and populate it in
`create-handler.ts` and `cf-serve.ts` (both already compute
`toDBFlavour(env.DB_FLAVOUR)`). The write handler reads `vctx.sql.flavour` to
decide whether to take the advisory lock.

## Components touched

- `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — replace the
  read-modify-write with the atomic insert + retry; PG advisory lock; typed
  conflict error. (`deleteDoc` in the same file uses the same seq-allocation
  pattern — apply the identical fix there.)
- `vibes.diy/api/svc/types.ts` — add `sql.flavour`.
- `vibes.diy/api/svc/create-handler.ts`, `cf-serve.ts` — populate `sql.flavour`.
- Tests (below).

## Error handling

- Self-race / overlapping writes: resolved silently to distinct revisions
  (LWW). No client error.
- True terminal conflict (retry exhausted, should be unreachable): typed
  `ResError { code: "conflict", message }` carrying the current head seq, so a
  future opt-in optimistic-concurrency client can use it. No raw SQL leakage.

## Testing

- **Self-race (regression for #2506):** fire many concurrent `putDoc` to one
  docId; assert all resolve, no rejection, `max(seq)` equals the count, every
  seq is distinct and contiguous. Run against the test backend (SQLite) where
  it deterministically reproduces the cross-round-trip race.
- **Atomic allocation:** assert seqs are gap-free and strictly increasing
  under concurrency.
- **Typed error shape:** force the retry path to exhaust (inject a stubbed
  always-conflict) and assert a `conflict`-coded `ResError`, never a raw SQL
  string.
- **deleteDoc parity:** same concurrency test for the delete path.
- PG-specific advisory-lock behavior is covered by the SQLite self-race test
  for correctness (distinct seqs); the lock is a PG performance guard, not a
  correctness change, so no PG-only integration test is added.

## Out of scope / follow-ups

- **`failOnConflict` / expected-base opt-in (issue option 3)** — needs
  `ReqPutDoc` + `database.put` runtime threading. Deferred.
- **`AppDocumentHead` redesign** — a separate head row with PK
  `(owner, app, db, docId)` upserted via `ON CONFLICT DO UPDATE SET seq =
head.seq + 1` (atomic increment, row-locked, no collision ever, LWW for
  free) is the cleanest long-term shape but needs a migration and read-path
  changes. **File as a follow-up issue.**
- **#2501** — prompt guidance that writes need no error handling stays
  consistent with the LWW default; revisit if the opt-in mode lands.
