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

### 1. Atomic seq allocation: single-statement `INSERT … SELECT MAX+1 … RETURNING`

Replace the `SELECT max` + `INSERT` pair with one statement that also returns
the allocated seq:

```sql
INSERT INTO "AppDocuments" (userSlug, appSlug, dbName, docId, seq, userId, data, deleted, created)
SELECT $owner, $app, $db, $docId,
       COALESCE(MAX(seq), 0) + 1,
       $userId, $data, 0, $now
FROM "AppDocuments"
WHERE userSlug = $owner AND appSlug = $app AND dbName = $db AND docId = $docId
RETURNING seq
```

(Identical statement shape works on both SQLite and Postgres; emitted via
drizzle's `sql` template.)

- **D1 / SQLite:** runs entirely under the write lock, so `MAX(seq)` always
  sees every committed row → **distinct seq every time, zero collisions, zero
  retries, zero storm.** The slider/self-race case is simply fixed.
- **Postgres:** halves round-trips and shrinks the window, but two concurrent
  `INSERT … SELECT` can still read the same `MAX` (the uncommitted row is
  invisible), so layer 2 is required there.

We need the **exact** `seq` this insert allocated — it is not merely a
notification hint. For direct-message writes the handler writes `nextSeq` into
`DirectChannelReads.lastSeenSeq` to auto-mark the _sender's own_ message as read
(`app-documents-write-eventos.ts:430`). A follow-up `SELECT MAX(seq)` can
observe a _concurrent_ writer's higher seq (Alice inserts seq 1, Bob inserts
seq 2 before Alice's re-read → Alice records `lastSeenSeq = 2`, silently marking
Bob's unread message as read). The `MAX(...)` in that upsert keeps it monotonic
but cannot prevent over-advancing, and on D1 nothing serializes the
insert→re-read pair, so the re-read is genuinely unsafe.

Therefore recover the allocated seq with **`RETURNING seq`** on the atomic
insert. `RETURNING` is supported on all backends (SQLite ≥3.35, libsql, D1,
Postgres). Pairing it with a raw `INSERT … SELECT` means reading the value out
of the raw driver result (D1 `ResultSet` vs libsql vs neon) rather than
drizzle's typed `.returning()`, so a small per-driver `extractReturnedSeq`
helper normalizes the result shape. Correctness across backends is worth the
helper. (This reverses an earlier "uniform `SELECT MAX`" lean — Codex review on
PR #2509 showed that lean was unsafe for the DM path.)

### 2. Postgres-only per-doc serialization: `pg_advisory_xact_lock`

When `flavour === "pg"`, open a transaction and take a transaction-scoped
advisory lock keyed on a hash of `(owner, app, db, docId)` as the first
statement:

```sql
SELECT pg_advisory_xact_lock(hashtextextended($key, 0))
```

**The transaction must wrap the insert _and_ the seq-dependent sidecar
effects** — at minimum the `AccessFnOutputs` upsert
(`app-documents-write-eventos.ts:503-523`), which is keyed only by
`(owner, app, db, docId)` with no seq. Without holding the lock through that
upsert, two same-doc writes returning different grants/channels can land their
sidecar upserts out of order, leaving reads/grants reflecting the _losing_
revision while `max(seq)` points at the winner (Codex P1 on PR #2509). Holding
the lock through the sidecar serializes the whole critical section, so the
highest-seq writer's grant state lands last.

`putDoc` and `deleteDoc` **must derive the identical lock key from the same
`(owner, app, db, docId)`** and acquire it inside the same transaction, or a
delete can interleave a put (per Charlie's review). Same-doc writers queue on
the lock instead of colliding → **O(N), not O(N²)**, no wasted retries.
Different docs never contend. The lock auto-releases at transaction end. SQLite
needs nothing for the seq insert itself — it serializes writes — but note the
**D1 limitation** below for sidecar ordering.

**D1 / SQLite sidecar ordering (known gap):** D1 has no multi-statement
interactive transaction spanning the insert and the `AccessFnOutputs` upsert, so
on D1 the sidecar can still reorder under true concurrency. We accept this as
best-effort on D1 for this server-side-only change; the durable cross-backend
fix (a `seq` column on `AccessFnOutputs` with a seq-conditional upsert) is rolled
into the `AppDocumentHead` follow-up below.

### 3. Bounded retry + typed conflict error (belt-and-suspenders)

Wrap the insert in a bounded retry that re-runs the atomic
`INSERT … SELECT MAX+1 … RETURNING seq`. Retry policy:

- **Retry only on** a PK-uniqueness violation (and, on PG, serialization-style
  errors). Any other error propagates immediately — do not blind-retry.
- **Cap at 3 attempts** with small jittered backoff between attempts to avoid
  synchronized re-collision.
- **On exhaustion**, return a **typed** `ResError` with `code: "conflict"`
  carrying the current head seq, never the raw `Failed query: insert…` string.

With layers 1+2 this path should essentially never be hit on either backend,
but it guarantees we never surface a raw SQL error.

### Threading the flavour

`DBFlavour` is known at handler construction (`create-handler.ts:248`) but is
not currently on `vctx.sql`. Add `flavour: DBFlavour` to the `sql` object in
`VibesApiSQLCtx` (`vibes.diy/api/svc/types.ts:29-32`) and populate it in
`create-handler.ts` and `cf-serve.ts` (both already compute
`toDBFlavour(env.DB_FLAVOUR)`). The write handler reads `vctx.sql.flavour` to
decide whether to take the advisory lock.

## Components touched

- `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — replace the
  read-modify-write with the atomic `INSERT … RETURNING seq` + retry; PG
  advisory lock + transaction wrapping the insert and the `AccessFnOutputs`
  sidecar; typed conflict error. (`deleteDoc` in the same file uses the same
  seq-allocation pattern — apply the identical fix, sharing the same per-doc
  lock key.)
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

Run the concurrency matrix against **both** backends (SQLite/D1 and, where the
harness supports it, PG) since the guarantees differ per backend:

- **Self-race (regression for #2506):** fire many concurrent `putDoc` to one
  docId; assert all resolve, no rejection, no raw SQL error, `max(seq)` equals
  the count, every seq is distinct and contiguous, and the latest revision is
  readable.
- **Allocated-seq attribution (Codex P1):** concurrent `putDoc`s where each
  returns its own seq; assert each writer's `RETURNING seq` matches its actual
  row (no over-advance), and the DM `lastSeenSeq` only covers the sender's own
  message.
- **Mixed `putDoc`/`deleteDoc` burst** on the same doc: no raw errors,
  monotonic seq, terminal state readable.
- **Bounded retries:** assert retry count stays ≤ cap and (on PG with the
  advisory lock) retries are rare/zero.
- **Typed error shape:** force the retry path to exhaust (inject a stubbed
  always-conflict) and assert a `conflict`-coded `ResError`, never a raw SQL
  string.
- **Sidecar ordering (PG):** two same-doc writes with different access-fn
  grants; assert final `AccessFnOutputs` reflects the highest-seq revision.
  (D1 sidecar ordering is best-effort per the known gap above — not asserted.)

## Out of scope / follow-ups

- **`failOnConflict` / expected-base opt-in (issue option 3)** — needs
  `ReqPutDoc` + `database.put` runtime threading. Deferred.
- **`AppDocumentHead` redesign + seq-conditional sidecars** — a separate head
  row with PK `(owner, app, db, docId)` upserted via
  `ON CONFLICT DO UPDATE SET seq = head.seq + 1` (atomic increment, row-locked,
  no collision ever, LWW for free), plus a `seq` column on `AccessFnOutputs`
  with a seq-conditional upsert (`WHERE excluded.seq > stored seq`) to make
  sidecar ordering correct on D1 too (closing the known D1 gap above). Cleanest
  long-term shape but needs a migration and read-path changes. **File as a
  follow-up issue.**
- **#2501** — prompt guidance that writes need no error handling stays
  consistent with the LWW default; revisit if the opt-in mode lands.
