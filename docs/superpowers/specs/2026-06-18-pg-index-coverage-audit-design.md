# Postgres Index Coverage Audit — Design / Validation Plan

**Issue:** generalizes #1530 ("Add (appSlug, userSlug) index on Apps") to the whole Neon schema
**Date:** 2026-06-18
**Status:** spec only — no schema change in this PR. The validation steps below need prod Neon access (`EXPLAIN ANALYZE`, `pg_stat_statements`) that this cloud session does not have. Pick up on an admin machine once Charlie approves the approach.

## Problem

#1530 found that the hottest viewer-path query filters `Apps` on `(ownerHandle, appSlug, mode)` but no index covers that predicate — Postgres falls back to the primary key (which leads with `appSlug`) and filters the rest in-row. It was flagged "defensive, not urgent" and closed with a single comment: **"Needs validation."**

That validation never happened, and #1530 only looked at one query. We have ~21 Postgres tables and we have never systematically checked that each table's **hot** query predicates are actually index-covered. This spec is that audit: enumerate every distinct query shape per table, compare it against the declared indexes **and** the primary key (a PK is a usable index on any leading-column prefix), and produce a prioritized, EXPLAIN-gated candidate list — plus an explicit list of predicates that are already fine, so nobody adds a redundant index.

## Scope

- **In:** the Drizzle PG schema `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts` and all the query call-sites that hit it under `vibes.diy/api/`.
- **Out:** the SQLite/D1/libsql schemas (`vibes-diy-api-schema-sqlite.ts`), Fireproof-internal storage, and any actual `CREATE INDEX` (those land in a follow-up PR, one per validated candidate, gated on the EXPLAIN evidence this plan produces).

## Method — how to read "is it covered?"

A B-tree index on `(a, b, c)` (a declared `index(...)` **or** a `primaryKey(...)`) serves:

- equality on `a`; on `a, b`; on `a, b, c`
- an equality prefix followed by a range or `ORDER BY` on the next column (`a = ? ORDER BY b`)

It does **not** efficiently serve a predicate that skips the leading column (`WHERE b = ?` alone, `WHERE c = ?`). That's the failure mode #1530 hit: PK is `(appSlug, userId, releaseSeq)`, the query leads with `ownerHandle`, so `ownerHandle` can't use the index at all.

For each query we record: WHERE columns (equality vs range), `GROUP BY`, `ORDER BY`, the file:line, and a hotness tag — **HOT** (per request: viewer page load, chat turn, SSR), **MED** (session/admin/interactive), **BATCH** (reports/ETL).

## Findings — candidate gaps (HOT first)

These are the predicates that are **genuinely not** covered by an existing index or a PK prefix. Each is a candidate, not a decision — the EXPLAIN step below confirms or kills it.

| #   | Table                            | Query predicate / sort                                                                                                                           | Covering index today                                                                                                                                                    | Gap                                                                                                                                                                 | Hotness                      | File:line                                                                             |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| C1  | `Apps`                           | `WHERE ownerHandle=? AND appSlug=? AND mode=?` `ORDER BY releaseSeq DESC LIMIT 1`                                                                | none — PK `(appSlug,userId,releaseSeq)` only covers `appSlug`; `ownerHandle`/`mode` filtered in-row                                                                     | **the #1530 gap**, now in the SSR hot path                                                                                                                          | **HOT**                      | `intern/get-vibe-route-hints.ts:69`, `public/serv-entry-point.ts:~300`                |
| C2  | `Apps`                           | `WHERE ownerHandle=? AND appSlug=?` `GROUP BY mode` + `max(created)`                                                                             | same as C1                                                                                                                                                              | sibling of C1 (older viewer RPC)                                                                                                                                    | HOT                          | `public/get-app-by-fsid.ts:116`                                                       |
| C3  | `Apps`                           | `WHERE userId=?` `ORDER BY created`                                                                                                              | none — `userId` is the **2nd** PK col, not a usable prefix → seq scan                                                                                                   | `checkMaxAppsPerUser` runs inside `ensureApps`, which fires on **every append-turn write** (not just new-app create), so this seq scan is on the chat-turn hot path | **HOT**                      | `intern/write-apps.ts:30` (via `write-apps.ts:344` ← `intern/append-turn-to-chat.ts`) |
| C4  | `ChatContexts`                   | `WHERE userId=? AND ownerHandle=? AND appSlug=? LIMIT 1`                                                                                         | none — only PK is `chatId` → seq scan                                                                                                                                   | chat-id resolution on generate/seed                                                                                                                                 | HOT                          | `intern/ensure-chat-id.ts:127`, `intern/ensure-push-seeded-chat.ts:~90`               |
| C5  | `ChatSections`                   | `WHERE chatId=?` `ORDER BY created[, promptId, blockSeq]`                                                                                        | `ChatSections_chatId_idx (chatId)` finds rows but the sort is a filesort                                                                                                | sort-only; cheap if rows-per-chat is small                                                                                                                          | MED                          | `intern/resend-prev-msg.ts:22`, `prompt-assembly.ts:175`                              |
| C6  | `AccessFnOutputs`                | `WHERE ownerHandle=? AND appSlug=? AND hasGrants=?`                                                                                              | PK `(ownerHandle,appSlug,dbName,docId)` covers the `(ownerHandle,appSlug)` prefix then filters `hasGrants` across all docs of the app                                   | scan width = all output rows for the app                                                                                                                            | HOT                          | `intern/who-am-i.ts:62,87`                                                            |
| C7  | `RequestGrants` / `InviteGrants` | `RequestGrants WHERE foreignUserId=? AND ownerHandle=? AND appSlug=?`; `InviteGrants WHERE tokenOrGrantUserId=? AND ownerHandle=? AND appSlug=?` | the single-column idx (`RequestGrants_foreignUserId_idx` / `InviteGrants_tokenOrGrantUserId_idx`) covers only the lead column; `ownerHandle`/`appSlug` are post-filters | viewer-access checks — scan width = all grants for that foreign user / token                                                                                        | **MED** (per Charlie review) | `request-flow.ts:152`, `invite-flow.ts:235`                                           |
| C8  | `AppDocuments`                   | `WHERE userId=?` `GROUP BY ownerHandle, appSlug`                                                                                                 | none — `userId` not in PK prefix `(ownerHandle,appSlug,…)` → seq scan                                                                                                   | **user-facing** membership list (not pure batch — elevated per Charlie review)                                                                                      | MED                          | `list-memberships.ts:169`                                                             |
| C9  | batch/report scans               | `RequestGrants WHERE state`, `InviteGrants WHERE state`, `AppDocuments WHERE created`, `AppSlugBindings WHERE created`                           | none for the leading predicate                                                                                                                                          | reports tolerate seq scans today                                                                                                                                    | BATCH                        | low                                                                                   | `usage-report/*`, `report-*.ts` |

### Proposed index shapes (to test, not to merge blindly)

- **C1/C2** — minimal #1530 form: `index("Apps_ownerHandle_appSlug").on(ownerHandle, appSlug)`. Covering variants to compare in EXPLAIN: `(ownerHandle, appSlug, mode, releaseSeq)` for C1's `LIMIT 1` and `(ownerHandle, appSlug, mode, created)` for C2's `GROUP BY mode`. Let the planner + real row counts pick; #1530 explicitly said "whichever PG planner prefers."
- **C3** — `index("Apps_userId_created").on(userId, created)` (covers the predicate and the `ORDER BY`).
- **C4** — `index("ChatContexts_userId_userSlug_appSlug").on(userId, ownerHandle, appSlug)`.
- **C5** — `index("ChatSections_chatId_created").on(chatId, created)` — only if EXPLAIN shows a meaningful sort cost.
- **C6** — `index("AccessFnOutputs_app_hasGrants").on(ownerHandle, appSlug, hasGrants)` — only if per-app output-row counts are large.
- **C7** — extend the existing single-column grant indexes to composites: `(foreignUserId, ownerHandle, appSlug)` on `RequestGrants`, `(tokenOrGrantUserId, ownerHandle, appSlug)` on `InviteGrants`. Prefer extending the current index over adding a near-twin; validate that the per-foreign-user / per-token scan width is large enough to matter.
- **C8** — `index("AppDocuments_userId").on(userId)` — validate the membership-list path's real row counts before committing.
- **C9** — defer; revisit when those tables grow. Reports tolerate seq scans today.

## Explicitly NOT gaps (already covered — do not add indexes)

The query map flagged these, but each is served by a PK prefix or an existing secondary index. Recording them so the follow-up doesn't add dead weight (every redundant index taxes the write path):

- `Apps` "latest by `appSlug,userId` ORDER BY releaseSeq DESC" — PK `(appSlug,userId,releaseSeq)` covers it exactly (`write-apps.ts:~368`).
- `AppDocuments` latest-revision read `WHERE ownerHandle,appSlug,dbName,docId ORDER BY seq DESC` — PK covers it exactly (this is the hottest Firefly read).
- `AccessFunctionBindings` `WHERE ownerHandle,appSlug,dbName IN (...)` — PK `(ownerHandle,appSlug,dbName)` covers it.
- `DirectChannelIndex` `WHERE handle IN (...)` — PK `(handle,channelHandle)` leading prefix.
- `DirectChannelReads` `WHERE channelHandle IN (...) AND handle IN (...)` — PK `(channelHandle,handle)` leading prefix.
- `RequestGrants` / `InviteGrants` `WHERE userId,appSlug,ownerHandle[,state]` — PK leads `(userId,appSlug,ownerHandle)`; trailing `state` is an in-row filter on an already-narrow scan.
- `AppSettings` `WHERE userId,ownerHandle,appSlug` — PK `(userId,appSlug,ownerHandle)`, all-equality, order-independent; plus `AppSettings_ownerHandle_appSlug_idx` covers the userId-less form.
- `UserSlugBindings` `WHERE userId` — `UserSlug_userId_ownerHandle (userId,handle)` leading prefix.
- `PromptContexts`, `AssetUploads`, `Assets`, `RefererEvents`, `LandingEvents`, `UserSettings` — current indexes/PKs match their query shapes.

## Investigation steps (run on an admin machine)

Tooling already exists in the repo:

- **Read-only** (`NEON_DATABASE_URL`): `pnpm --dir vibes.diy/api/svc run db:inspect sql "EXPLAIN ..."` — the allowlist already permits `EXPLAIN`/`SELECT`/`WITH`/`SHOW`.
- **Write** (`NEON_DATABASE_ADMIN_URL`): `pnpm --dir vibes.diy/api/svc run db:admin sql "CREATE INDEX CONCURRENTLY ..."`.

### Step 0 — snapshot reality (don't trust the schema file)

Confirm what is actually deployed in prod, plus table sizes so priority is grounded in real volume:

```sql
-- declared vs. deployed
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public' ORDER BY tablename, indexname;

-- row counts + on-disk size
SELECT relname, reltuples::bigint AS est_rows,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC;
```

### Step 1 — let the database name the hot queries

Don't rank by gut. `pg_stat_statements` is available on Neon:

```sql
SELECT calls, total_exec_time, mean_exec_time, rows, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 40;
```

Cross-check the top entries against C1–C6. Anything expensive that isn't in our candidate list is a new finding; anything in our list that never shows up can be down-graded.

### Step 2 — find seq scans and dead indexes

```sql
-- tables doing heavy sequential reads = missing-index suspects
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 20;

-- indexes that are never used = removal candidates (write-cost with no read benefit)
SELECT relname AS table, indexrelname AS index, idx_scan
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY relname;
```

The audit cuts both ways: an unused declared index is as much a finding as a missing one.

### Step 3 — per-candidate before/after EXPLAIN

For each surviving candidate, with representative param values pulled from a real row:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ... ;   -- the exact query from the file:line above
```

Confirm the **before** plan shows a `Seq Scan` or a wide PK scan with a `Filter:` discarding many rows. Then build the index, re-`ANALYZE`, and re-plan — **each as its own `db:admin sql` invocation**:

```sql
-- invocation 1 (MUST be alone — see note)
CREATE INDEX CONCURRENTLY <name> ON "<Table>" (<cols>);
```

```sql
-- invocation 2
ANALYZE "<Table>";
```

```sql
-- invocation 3 — expect Index Scan, lower cost + actual time
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;
```

> `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. `db:admin`/`admin-db.ts` hands the whole SQL string to a single `pool.query`, and Postgres runs a semicolon-separated batch as one implicit transaction — so combining the three statements above into one `db:admin sql "..."` call fails with `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. Run the concurrent build by itself, then `ANALYZE` and `EXPLAIN` in separate calls.

Keep the index only if the **after** plan switches to an index scan **and** the measured time drops materially. Record before/after `cost` and `actual time` in the follow-up PR description, mirroring #1530's "EXPLAIN ANALYZE before/after" ask.

### Step 4 — weigh the write cost

`Apps`, `AppDocuments`, `ChatSections`, `ChatContexts` are write-hot (every publish / chat turn / doc revision inserts). The schema already documents this tension — see the `AppSlugBindings.updated` comment (column deliberately kept **out** of the index so `bumpAppRecency` stays HOT-update-eligible). For each new index confirm it doesn't:

- add a non-HOT index update to a per-turn write path, or
- duplicate an existing index's leading columns (prefer extending one index over adding a near-twin).

A candidate that wins Step 3 but is on a write-hot table still has to clear this gate.

## Rollout notes (for the follow-up PR, not this one)

- **Build indexes with `CREATE INDEX CONCURRENTLY` via `db:admin` first**, then add the matching `index(...)` to `vibes-diy-api-schema-pg.ts`. `drizzle-kit push` (`drizzle:neon`) issues a plain `CREATE INDEX`, which takes a lock that blocks writes for the whole build — unacceptable on hot tables like `Apps`/`AppDocuments`. Building concurrently out-of-band first makes the later `push` a no-op reconcile.
- The schema is the source of truth across prod/dev/preview/cli, so every index that survives validation **must** land in `vibes-diy-api-schema-pg.ts` (not just in prod) or the next `push` to another env will drift.
- One follow-up PR per validated index (or one small batch), each carrying its before/after EXPLAIN evidence. Close #1530 by merging C1.

## Deliverable of the validation pass

A short report appended here (or in the follow-up PR) with, per candidate: the `pg_stat_statements` rank, before/after EXPLAIN cost + actual time, the chosen index shape, and a keep/drop verdict. That turns "Needs validation" into a decision with evidence behind it.

---

# Validation results — run against prod Neon `vibes-diy` (2026-06-18)

Ran Steps 0–3 read-only via `pnpm --dir vibes.diy/api/svc run db:inspect sql "EXPLAIN …"`. No schema change made. **Headline: at current scale and data distribution, none of C1–C8 justify a new index — and #1530's own gap (C1) is validated as harmless. The one genuinely actionable finding is the opposite of the spec's hypothesis: five _dead_ indexes that only tax the write path and should be dropped.**

Column-name note: the deployed schema uses `userSlug` where this spec wrote `ownerHandle` (same column, aspirational naming) — EXPLAINs below use the deployed names.

## Step 0 — scale reality (the result that reframes everything)

Only two tables are large enough for an index to matter; the rest fit in a few pages and the planner prefers seq scans for them regardless of indexes.

| Table                  | est rows | total size |
| ---------------------- | -------- | ---------- |
| Assets                 | 10,202   | 405 MB     |
| ChatSections           | 40,841   | 165 MB     |
| AppDocuments           | 91,800   | 74 MB      |
| Apps                   | 6,202    | 13 MB      |
| AppSettings            | 3,237    | 6.3 MB     |
| ChatContexts           | 3,288    | 648 kB     |
| AccessFnOutputs        | 1,557    | 600 kB     |
| RequestGrants          | 256      | 448 kB     |
| UserSlugBindings       | 190      | 144 kB     |
| AccessFunctionBindings | 157      | 128 kB     |
| InviteGrants           | ~2       | 64 kB      |

## Step 1 — `pg_stat_statements` unavailable

`relation "pg_stat_statements" does not exist` for the `vibes-diy-app` role on this Neon connection. Couldn't rank by query exec time. Substituted `pg_stat_user_tables` / `pg_stat_user_indexes` (Step 2) as the hotness signal. Enabling the extension (or granting the app role access) would let a future pass rank by real exec time — worth doing, but not a blocker for the verdicts below.

## Step 2 — seq-scan reality (cumulative since last stats reset)

Ranked by `seq_tup_read`:

| Table            | seq_scan      | seq_tup_read    | idx_scan  | live rows |
| ---------------- | ------------- | --------------- | --------- | --------- |
| AppDocuments     | 19,585        | **430,304,853** | 649       | 87,879    |
| AppSettings      | 259,950       | 327,444,585     | 7,681,137 | 3,290     |
| UserSlugBindings | **1,625,535** | 84,258,559      | 157,198   | 193       |
| AppSlugBindings  | 8,521         | 20,971,541      | 22,886    | 3,672     |
| ChatContexts     | 7,235         | 14,213,879      | 7,140     | 3,288     |
| Apps             | 2,214         | 7,150,156       | 778,321   | 6,274     |
| ChatSections     | **17**        | 434,186         | 12,650    | 41,447    |

Two of the top-three seq-scanners (AppSettings, UserSlugBindings) were on the spec's **"already covered — do not add"** list. Step 3 below shows that classification was correct — they seq-scan because the planner _chooses_ to on small / in-memory tables, not because an index is missing. Conversely **ChatSections — the biggest table by query-relevant size — has had 17 seq scans, ever** (12,650 index scans): **C5 is a non-issue, killed.**

## Step 3 — per-candidate EXPLAIN (ANALYZE) verdicts

| #      | Table                                                    | Observed plan                                                                                                       | Time               | Verdict                                                                                                                                                                              |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C1** | Apps viewer `userSlug,appSlug,mode ORDER BY releaseSeq`  | Bitmap Index Scan on PK via `appSlug`, filters `userSlug`+`mode` in-row (1 row rechecked)                           | **0.063 ms**       | **DROP.** `appSlug` is selective enough on its own; the in-row filter touches ~1 row. **This is the #1530 gap — validated as not needed.** Answers "Needs validation": don't add it. |
| C2     | Apps `GROUP BY mode` (older RPC)                         | same PK access path as C1                                                                                           | sub-ms             | **DROP** (same reasoning as C1).                                                                                                                                                     |
| C3     | Apps `WHERE userId ORDER BY created`                     | Index Scan on PK (`userId` as non-leading cond) — already avoids a heap seq scan                                    | 0.5 ms             | **DROP.** Planner uses the PK index, not a heap scan; 6k rows.                                                                                                                       |
| **C4** | ChatContexts `userId,userSlug,appSlug LIMIT 1`           | Seq Scan, 3,287 rows filtered                                                                                       | 0.29 ms            | **WATCH.** Genuine seq scan but trivially cheap at 3k rows; cost grows linearly with the table. Revisit if ChatContexts passes ~100k rows. No action now.                            |
| C5     | ChatSections sort                                        | n/a — 17 lifetime seq scans, fully index-served                                                                     | —                  | **DROP.** Not a real workload.                                                                                                                                                       |
| C6     | AccessFnOutputs `userSlug,appSlug,hasGrants`             | Bitmap Index Scan on `AccessFnOutputs_grants_idx` `(userSlug,appSlug)` prefix, `hasGrants` filtered in-row (6 rows) | 0.066 ms           | **DROP.** Per-app output counts are tiny; adding `hasGrants` saves microseconds.                                                                                                     |
| C7     | RequestGrants / InviteGrants composites                  | single-page tables (256 / ~2 rows)                                                                                  | sub-ms             | **DROP.** Planner prefers seq scan on single-page tables; an index would be ignored.                                                                                                 |
| **C8** | AppDocuments membership list (`list-memberships.ts:170`) | **see below — split verdict**                                                                                       | 0.056 ms / 50.9 ms | **DROP** (with a caveat).                                                                                                                                                            |

### C8 in detail — the spec's top-ranked gap, debunked

The real query is **not** a bare `WHERE userId GROUP BY` (that shape seq-scans, 21 ms — but it doesn't exist in the code). The actual call (`list-memberships.ts:165-171`) is `WHERE userId = ? AND ((userSlug,appSlug) OR …) GROUP BY userSlug,appSlug` — and the `(userSlug,appSlug)` pairs **are** a PK prefix. Two regimes:

- **Normal user** (e.g. 15 docs in one app): **Index Scan on the PK**, `Index Cond: (userSlug,appSlug)`, 18 buffers, **0.056 ms**. The PK already covers it perfectly.
- **Whale user** (`joshuakrasn` owns **66,184 of 91,817 rows = 72% of the table**): Parallel Seq Scan, ~62 MB, **50.9 ms** — because their own `(userSlug,appSlug)` sets match ~21k rows each, so no index on `userId`/`(userSlug,appSlug)` is selective _for them_. A `(userId,…)` index would be ignored here too.

So the 430 M `seq_tup_read` on AppDocuments is a **power-law data-distribution artifact** (one whale's membership-list loads), not a missing-index problem. **No index proposed in this spec fixes it.** If the whale path becomes a measured problem, the fix is a covering `(userSlug, appSlug, created)` index to enable an index-only `MAX(created)` per group — a different shape from C8's proposal, and still only worth it if that one user's loads actually hurt. Logged here rather than acted on.

## Actual actionable finding — dead indexes to DROP (the audit cuts both ways)

`pg_stat_user_indexes` with `idx_scan = 0` since the last stats reset. Each is pure write-amplification with zero read benefit on a live table:

| Table          | Index                                               | Note                                             |
| -------------- | --------------------------------------------------- | ------------------------------------------------ |
| AssetUploads   | `AssetUploads_app_idx` `(userSlug,appSlug,created)` | unused; AssetUploads is on the upload write path |
| AssetUploads   | `AssetUploads_user_idx` `(userId,created)`          | unused                                           |
| InviteGrants   | `InviteGrants_cursor` `(created)`                   | unused                                           |
| LandingEvents  | `LandingEvents_utmCampaign_ts_idx`                  | unused                                           |
| PromptContexts | `PromptContext_nethash_idx` `(nethash)`             | unused; PromptContexts inserts every chat turn   |

(`MissingVibeEvents_*` also show 0 scans but the table is empty — ignore.) Before dropping, confirm no low-frequency/admin query depends on them since the last stats reset window; `DROP INDEX CONCURRENTLY` via `db:admin` in a follow-up PR.

## Bottom line

- **#1530 (C1): validated → do NOT add the index.** EXPLAIN shows `appSlug` alone resolves the viewer query in 0.063 ms. #1530 can be closed as "validated, not needed" rather than by merging an index.
- **C2, C3, C5, C6, C7: drop** — already index-served or on tables too small for an index to change the plan.
- **C4 (ChatContexts): watch**, no action now; revisit past ~100k rows.
- **C8 (AppDocuments): the heavy seq scans are one whale's data distribution, not a missing index** — normal users already hit the PK at 0.056 ms.
- **Real follow-up work is removal, not addition**: drop 5 dead indexes (above). Optionally enable `pg_stat_statements` for the app role so the next pass can rank by real exec time.

All measurements are read-only `EXPLAIN (ANALYZE, BUFFERS)` against prod on 2026-06-18; representative params pulled from live rows.
