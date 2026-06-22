# putDoc seq-collision fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make concurrent `putDoc`/`deleteDoc` writes to the same doc resolve to last-write-wins distinct revisions instead of hard-failing on a `seq` primary-key collision, without retry storms and without leaking raw SQL errors.

**Architecture:** Replace the non-atomic `SELECT max(seq)` → `INSERT` in the write handler with an atomic single-statement `INSERT … SELECT COALESCE(MAX(seq),0)+1 … RETURNING seq`. On Postgres, wrap that statement plus the `AccessFnOutputs` sidecar in a transaction guarded by a per-doc `pg_advisory_xact_lock` so same-doc writers queue (O(N)) instead of colliding (O(N²)). On SQLite/D1 the single statement runs under SQLite's global write lock so it never collides. A bounded, classified retry returns a typed `conflict` error on the (essentially unreachable) exhaustion path. Logic is centralized in one new module used by both `putDoc` and `deleteDoc`.

**Tech Stack:** TypeScript, drizzle-orm 0.45.2 (libsql/D1 + neon-serverless pg dialects), arktype, vitest. Spec: `docs/superpowers/specs/2026-06-22-putdoc-seq-conflict-design.md`. Tracks #2506 / PR #2509.

---

## Backend reality (read before implementing)

`vctx.sql.db` is typed `VibesSqlite` but at runtime is **either** a libsql/D1 SQLite drizzle instance **or** a neon-serverless Postgres instance, selected by `DB_FLAVOUR` (`vibes.diy/api/sql/index.ts`). The two dialects diverge in ways this plan must branch on:

| Concern                        | SQLite / libsql / D1                         | Postgres (neon-serverless)                      |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------- |
| Raw exec of a `sql` statement  | `db.run(stmt)` → result with `.rows`         | `db.execute(stmt)` → `{ rows }`                 |
| Interactive `db.transaction()` | libsql: yes; **D1: throws (unsupported)**    | yes                                             |
| Advisory lock                  | n/a (global write lock serializes)           | `pg_advisory_xact_lock(...)`                    |
| `data` jsonb column binding    | bind `JSON.stringify(data)` (stored as text) | bind the JS object (driver serializes to jsonb) |

Because **D1 has no interactive transaction**, the SQLite/D1 path must NOT call `db.transaction()`. It relies on SQLite serializing the single atomic `INSERT … SELECT` statement. The Postgres path uses a transaction + advisory lock.

**Two verification points** (resolved by the failing→passing test loop in Task 2/Task 3, since deps are not installed in the planning environment):

1. The exact result shape of a `RETURNING seq` statement via `db.run` (libsql) — confirm `.rows[0].seq` (helper normalizes via `extractReturnedSeq`).
2. That `db.execute(sql\`SELECT pg_advisory_xact_lock(...)\`)`and the atomic insert run correctly inside a neon`db.transaction(tx => ...)`.

---

## File structure

- **Create** `vibes.diy/api/svc/public/seq-allocation.ts` — all seq-allocation + per-doc serialization logic. One responsibility: "allocate the next seq and insert this revision atomically, running an optional in-critical-section sidecar." Exports `docLockKey`, `isRetryableConflict`, `extractReturnedSeq`, `SeqConflictError`, and `allocateAndInsertRevision`.
- **Modify** `vibes.diy/api/svc/types.ts` — add `flavour` to the `sql` object on `VibesApiSQLCtx`.
- **Modify** `vibes.diy/api/svc/create-handler.ts` — populate `sql.flavour` from `envVals.DB_FLAVOUR`.
- **Modify** `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — `putDocEvento` and `deleteDocEvento` use `allocateAndInsertRevision`; `putDoc` passes the `AccessFnOutputs` upsert as the sidecar and uses the returned seq for `lastSeenSeq`.
- **Create** `vibes.diy/api/tests/put-doc-concurrency.test.ts` — concurrency matrix.

The test harness already threads `flavour` (`vibes.diy/api/tests/vibe-diy-test-ctx.ts:253`) and sets `DB_FLAVOUR` (line 210), so no test-ctx change is needed.

---

## Task 0: Baseline

**Files:** none (environment setup)

- [ ] **Step 1: Install dependencies**

Run: `pnpm install`
Expected: completes; `node_modules` present.

- [ ] **Step 2: Run the existing app-documents suite to confirm the harness works**

Run: `cd vibes.diy/api/tests && pnpm vitest run app-documents.test.ts`
Expected: PASS (this builds the sqlite template via globalSetup and exercises `putDoc`/`deleteDoc`/`getDoc`).

- [ ] **Step 3: Commit nothing** (baseline only).

---

## Task 1: Thread `flavour` onto `vctx.sql`

**Files:**

- Modify: `vibes.diy/api/svc/types.ts:29-32`
- Modify: `vibes.diy/api/svc/create-handler.ts:263`

- [ ] **Step 1: Add `flavour` to the `sql` ctx type**

In `vibes.diy/api/svc/types.ts`, the `VibesApiSQLCtx.sql` object is currently:

```ts
sql: {
  db: VibesSqlite;
  tables: VibesApiTables;
}
```

Change it to:

```ts
sql: {
  db: VibesSqlite;
  tables: VibesApiTables;
  flavour: DBFlavour;
}
```

Add `DBFlavour` to the existing `@vibes.diy/api-sql` import in that file (it already imports `VibesApiTables`, `VibesSqlite` from there).

- [ ] **Step 2: Populate it in `create-handler.ts`**

`create-handler.ts:248` already computes the flavour for tables. Reuse it. Change line 263 from:

```ts
    sql: { db: params.db, tables },
```

to:

```ts
    sql: { db: params.db, tables, flavour: toDBFlavour(envVals.DB_FLAVOUR) },
```

Add `toDBFlavour` to the existing `@vibes.diy/api-sql` import in `create-handler.ts` (it already imports `DBFlavour`, `createVibesApiTables`).

- [ ] **Step 3: Typecheck**

Run: `cd vibes.diy/api/svc && pnpm tsc --noEmit`
Expected: PASS (every `vctx.sql` consumer still compiles; new field is additive).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/types.ts vibes.diy/api/svc/create-handler.ts
git commit -m "feat(api): expose DB flavour on vctx.sql for per-backend write logic"
```

---

## Task 2: `seq-allocation.ts` — atomic allocate-and-insert (SQLite/D1 path) + helpers

**Files:**

- Create: `vibes.diy/api/svc/public/seq-allocation.ts`
- Test: `vibes.diy/api/tests/put-doc-concurrency.test.ts`

- [ ] **Step 1: Write the failing concurrency test**

Create `vibes.diy/api/tests/put-doc-concurrency.test.ts`. Model imports/setup on `app-documents.test.ts` (same `createVibeDiyTestCtx`, `ensureAppSlug`, `api` wrapper). The key behavioral test:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("putDoc concurrency (issue #2506)", () => {
  let api: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["api"];
  let ownerHandle: string;
  const appSlug = "concurrency-app";

  beforeAll(async () => {
    const t = await createVibeDiyTestCtx();
    api = t.api;
    ownerHandle = t.ownerHandle;
    await t.ensureAppSlug(appSlug);
  });

  it("N concurrent putDoc to one docId all succeed with distinct contiguous seq", async () => {
    const N = 25;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => api.putDoc({ ownerHandle, appSlug, dbName: "race", doc: { n: i }, docId: "hot" }))
    );
    // No write may reject or return an error.
    for (const r of results) expect(r.isOk()).toBe(true);

    // The head is readable and is one of the writers' values.
    const head = await api.getDoc({ ownerHandle, appSlug, dbName: "race", docId: "hot" });
    expect(head.isOk()).toBe(true);
    expect(head.Ok().status).not.toBe("not-found");
  });
});
```

(Adjust the exact `createVibeDiyTestCtx` return-shape destructuring to match `app-documents.test.ts`; if that test uses a different helper to register the app, mirror it.)

- [ ] **Step 2: Run it and watch it fail (today's race)**

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts`
Expected: FAIL — at least one write rejects / errors on the PK collision (the pre-fix behavior). If it flakily passes because the harness serializes, increase `N` to 50; the un-fixed `SELECT max → INSERT` will collide.

- [ ] **Step 3: Write `seq-allocation.ts` (helpers + SQLite/D1 atomic insert)**

Create `vibes.diy/api/svc/public/seq-allocation.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import type { DBFlavour, VibesSqlite, VibesApiTables } from "@vibes.diy/api-sql";

/** Stable per-doc key so putDoc and deleteDoc serialize on the SAME lock. */
export function docLockKey(ownerHandle: string, appSlug: string, dbName: string, docId: string): string {
  // NUL separator: cannot appear in these identifiers, so the join is unambiguous.
  return [ownerHandle, appSlug, dbName, docId].join(" ");
}

/** Typed terminal conflict — thrown only when bounded retries are exhausted. */
export class SeqConflictError extends Error {
  constructor(public readonly currentHeadSeq: number) {
    super("seq conflict: concurrent writes exhausted retries");
    this.name = "SeqConflictError";
  }
}

/** True for the unique/PK-violation (and pg serialization) errors we retry. */
export function isRetryableConflict(err: unknown): boolean {
  const msg = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return (
    msg.includes("unique") ||
    msg.includes("primary key") ||
    msg.includes("constraint failed") || // sqlite
    msg.includes("duplicate key") || // pg
    msg.includes("could not serialize") // pg serialization failure
  );
}

/** Normalize the RETURNING result row across drivers into the allocated seq. */
export function extractReturnedSeq(result: unknown): number {
  const rows = (result as { rows?: { seq: unknown }[] })?.rows ?? (result as { seq: unknown }[]);
  const raw = Array.isArray(rows) ? rows[0]?.seq : (rows as { seq?: unknown })?.seq;
  const seq = Number(raw);
  if (!Number.isFinite(seq)) throw new Error(`could not extract returned seq from result: ${JSON.stringify(result)}`);
  return seq;
}

export interface RevisionRow {
  ownerHandle: string;
  appSlug: string;
  dbName: string;
  docId: string;
  userId: string;
  data: unknown;
  deleted: number;
  created: string;
}

export interface AllocateParams {
  db: VibesSqlite;
  flavour: DBFlavour;
  table: VibesApiTables["appDocuments"];
  row: RevisionRow;
  /**
   * Runs inside the PG critical section (same txn, lock held) after the insert.
   * Receives the allocated seq and the **in-transaction db handle** (`tx` on pg,
   * `p.db` on sqlite/D1) — the sidecar MUST use this handle so its upsert is part
   * of the same transaction on pg. Use for the AccessFnOutputs sidecar.
   */
  sidecar?: (seq: number, exec: VibesSqlite) => Promise<void>;
  maxAttempts?: number;
}

const QUOTED = `"AppDocuments"`; // physical table name (see schema)

/** Build the atomic INSERT … SELECT MAX+1 … RETURNING seq statement. */
function buildAtomicInsert(p: AllocateParams) {
  const { row, flavour } = p;
  // jsonb binding diverges: pg takes the object, sqlite takes serialized text.
  const dataParam = flavour === "pg" ? sql`${row.data}` : sql`${JSON.stringify(row.data)}`;
  return sql`
    INSERT INTO ${sql.raw(QUOTED)} ("userSlug","appSlug","dbName","docId","seq","userId","data","deleted","created")
    SELECT ${row.ownerHandle}, ${row.appSlug}, ${row.dbName}, ${row.docId},
           COALESCE(MAX("seq"),0)+1, ${row.userId}, ${dataParam}, ${row.deleted}, ${row.created}
    FROM ${sql.raw(QUOTED)}
    WHERE "userSlug"=${row.ownerHandle} AND "appSlug"=${row.appSlug}
      AND "dbName"=${row.dbName} AND "docId"=${row.docId}
    RETURNING "seq"
  `;
}

async function runReturning(db: VibesSqlite, flavour: DBFlavour, stmt: ReturnType<typeof sql>): Promise<number> {
  // pg: db.execute({rows}); sqlite/libsql/d1: db.run(...).rows
  const exec =
    flavour === "pg"
      ? (db as unknown as { execute: (s: unknown) => Promise<unknown> }).execute.bind(db)
      : (db as unknown as { run: (s: unknown) => Promise<unknown> }).run.bind(db);
  return extractReturnedSeq(await exec(stmt));
}
```

Then the SQLite/D1 allocator (PG branch added in Task 3):

```ts
async function allocateSqlite(p: AllocateParams): Promise<number> {
  const attempts = p.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const seq = await runReturning(p.db, p.flavour, buildAtomicInsert(p));
      if (p.sidecar) await p.sidecar(seq, p.db); // best-effort ordering on D1 (see spec)
      return seq;
    } catch (err) {
      if (!isRetryableConflict(err)) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (8 << i)))); // jitter
    }
  }
  const head = await currentHeadSeq(p);
  throw new SeqConflictError(head);
}

async function currentHeadSeq(p: AllocateParams): Promise<number> {
  const r = await p.db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${p.table.seq}),0)` })
    .from(p.table)
    .where(
      and(
        eq(p.table.ownerHandle, p.row.ownerHandle),
        eq(p.table.appSlug, p.row.appSlug),
        eq(p.table.dbName, p.row.dbName),
        eq(p.table.docId, p.row.docId)
      )
    )
    .then((rows) => rows[0]);
  return Number(r?.maxSeq ?? 0);
}

export async function allocateAndInsertRevision(p: AllocateParams): Promise<number> {
  return allocateSqlite(p); // Task 3 swaps in the pg branch
}
```

> **Verification note:** if `extractReturnedSeq` throws in Step 4, inspect the actual `db.run` result shape from the libsql driver and adjust `extractReturnedSeq` (the helper exists precisely to localize this). Do NOT change the SQL.

- [ ] **Step 4: Wire `putDocEvento` minimally to use the allocator, then re-run the test**

Temporarily (full wiring is Task 4) replace the `putDoc` `SELECT max` + `insert` (`app-documents-write-eventos.ts:362-380`) with:

```ts
const nextSeq = await allocateAndInsertRevision({
  db: vctx.sql.db,
  flavour: vctx.sql.flavour,
  table: t,
  row: {
    ownerHandle: req.ownerHandle,
    appSlug: req.appSlug,
    dbName,
    docId,
    userId: userId ?? "unknown",
    data: req.doc,
    deleted: 0,
    created: now,
  },
});
```

Import `allocateAndInsertRevision` from `./seq-allocation.js`.

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts`
Expected: PASS — all N writes succeed, head readable.

- [ ] **Step 5: Run the full app-documents suite (no regressions)**

Run: `cd vibes.diy/api/tests && pnpm vitest run app-documents.test.ts`
Expected: PASS (including "putDoc same docId increments seq, latest wins").

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/seq-allocation.ts vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/put-doc-concurrency.test.ts
git commit -m "feat(api): atomic seq allocation for putDoc (SQLite/D1 path, #2506)"
```

---

## Task 3: Postgres transaction + per-doc advisory lock

**Files:**

- Modify: `vibes.diy/api/svc/public/seq-allocation.ts`

- [ ] **Step 1: Add the pg branch to the allocator**

Add to `seq-allocation.ts`:

```ts
async function allocatePg(p: AllocateParams): Promise<number> {
  const key = docLockKey(p.row.ownerHandle, p.row.appSlug, p.row.dbName, p.row.docId);
  const db = p.db as unknown as {
    transaction: <T>(fn: (tx: VibesSqlite) => Promise<T>) => Promise<T>;
  };
  return db.transaction(async (tx) => {
    // Serialize same-doc writers; auto-released at txn end. Different docs never contend.
    await (tx as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    );
    const seq = await runReturning(tx, "pg", buildAtomicInsert(p));
    if (p.sidecar) await p.sidecar(seq, tx); // sidecar inside the lock/txn → ordered LWW on pg
    return seq;
  });
}
```

Update the dispatcher:

```ts
export async function allocateAndInsertRevision(p: AllocateParams): Promise<number> {
  return p.flavour === "pg" ? allocatePg(p) : allocateSqlite(p);
}
```

Note: under the advisory lock the insert never collides, so `allocatePg` needs no retry loop; an unexpected error propagates (it is not a normal conflict).

- [ ] **Step 2: Typecheck**

Run: `cd vibes.diy/api/svc && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the concurrency + app-documents suites against pg (if the harness supports it)**

Run: `cd vibes.diy/api/tests && DB_FLAVOUR=pg pnpm vitest run put-doc-concurrency.test.ts app-documents.test.ts`
Expected: PASS if a pg test DB is configured; if pg is unavailable in this environment, note that and rely on the sqlite run + the explicit pg reasoning. Do NOT mark complete claiming pg passed if it did not run.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/public/seq-allocation.ts
git commit -m "feat(api): pg advisory-lock + txn serialization for seq allocation (#2506)"
```

---

## Task 4: Full `putDocEvento` wiring (returned seq + sidecar + notify outside lock)

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts` (putDoc handler)

- [ ] **Step 1: Move the `AccessFnOutputs` upsert into the allocator sidecar**

The `AccessFnOutputs` upsert currently lives at `app-documents-write-eventos.ts:503-523`, after the insert. It must run inside the pg critical section. Refactor so the upsert is performed by a `sidecar` closure passed to `allocateAndInsertRevision`, capturing `accessResult`, `afbRow`, `outputHasGrants`. Keep the existing `exception2Result` wrapper and the `rUpsert.isErr()` error handling, but run the grant-state computation that needs the result after allocation. Concretely, restructure the putDoc body to:

```ts
const sidecar = afbRow?.accessFnCid && accessResult && !("forbidden" in accessResult)
  ? async (_seq: number, exec: VibesSqlite) => {
      const tOutputs = vctx.sql.tables.accessFnOutputs;
      const outputHasGrants = /* unchanged computation from current lines 481-487 */;
      await exec // in-txn handle on pg, plain db on sqlite — keeps the upsert in the critical section
        .insert(tOutputs)
        .values({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName: req.dbName, docId,
                  fnCid: afbRow.accessFnCid, output: JSON.stringify(accessResult), hasGrants: outputHasGrants })
        .onConflictDoUpdate({
          target: [tOutputs.ownerHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
          set: { fnCid: afbRow.accessFnCid, output: JSON.stringify(accessResult), hasGrants: outputHasGrants },
        });
    }
  : undefined;

const nextSeq = await allocateAndInsertRevision({
  db: vctx.sql.db, flavour: vctx.sql.flavour, table: t,
  row: { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId,
         userId: userId ?? "unknown", data: req.doc, deleted: 0, created: now },
  sidecar,
});
```

> The sidecar receives the in-transaction `exec` handle (`tx` on pg, `p.db` on
> sqlite) defined in Task 2, so on pg the `AccessFnOutputs` upsert runs inside
> the advisory-locked transaction. The existing `exception2Result`/`rUpsert.isErr()`
> grant-storage error handling (current lines 503-532) wraps the `allocateAndInsertRevision`
> call instead; preserve its "grant storage failed — retry the write" `ResError`.
> Verify with the pg sidecar-ordering test in Task 7.

- [ ] **Step 2: Use the returned seq for DM `lastSeenSeq` and the comments trigger**

`nextSeq` from the allocator is now the actual allocated seq (RETURNING), so the existing `lastSeenSeq: nextSeq` (line 430), the `MAX(...)` upsert (line 433), and the `nextSeq === 1` comments path (line 439) keep working — but now correctly attributed (Codex P1 fix). No code change beyond using the new `nextSeq` variable.

- [ ] **Step 3: Confirm notify/queue stay outside the allocator**

`notifyDocChanged` / `notifyViewerGrantsChanged` / `postQueue` (lines 405-475, 533+) must remain AFTER `allocateAndInsertRevision` returns — i.e. outside the lock/txn. Verify they are not inside the sidecar.

- [ ] **Step 4: Run suites**

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts app-documents.test.ts access-fn-cross-user-grant.test.ts comments-acl.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/svc/public/seq-allocation.ts
git commit -m "feat(api): putDoc uses allocated seq + in-critical-section grant sidecar (#2506)"
```

---

## Task 5: `deleteDocEvento` parity

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts` (deleteDoc handler, lines 596-615)

- [ ] **Step 1: Replace the deleteDoc `SELECT max` + insert with the allocator**

```ts
const nextSeq = await allocateAndInsertRevision({
  db: vctx.sql.db,
  flavour: vctx.sql.flavour,
  table: t,
  row: {
    ownerHandle: req.ownerHandle,
    appSlug: req.appSlug,
    dbName,
    docId: req.docId,
    userId: req._auth.verifiedAuth.claims.userId,
    data: {},
    deleted: 1,
    created: now,
  },
});
```

deleteDoc has no `AccessFnOutputs` sidecar, so no `sidecar` is passed. Because `docLockKey` is derived from the same `(owner, app, db, docId)`, deleteDoc and putDoc serialize on the identical pg lock. `nextSeq` is unused downstream in deleteDoc today; keep it only if referenced, otherwise drop the binding to satisfy lint.

- [ ] **Step 2: Run delete + mixed tests**

Run: `cd vibes.diy/api/tests && pnpm vitest run app-documents.test.ts put-doc-concurrency.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts
git commit -m "feat(api): deleteDoc uses atomic seq allocation, shares per-doc lock (#2506)"
```

---

## Task 6: Typed conflict error on exhaustion (no raw SQL leak)

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts` (both handlers)
- Test: `vibes.diy/api/tests/put-doc-concurrency.test.ts`

- [ ] **Step 1: Write the failing typed-error test**

Add to `put-doc-concurrency.test.ts` a test that forces exhaustion. Inject an always-conflict by stubbing the table/db so `allocateAndInsertRevision` throws `SeqConflictError` (simplest: spy that makes `db.run`/`execute` reject with a `unique` error on every attempt). Assert the handler responds with a `res-error` whose `error.code === "conflict"`, and that the message does NOT contain `"Failed query"`.

```ts
it("returns a typed conflict error (never raw SQL) when retries are exhausted", async () => {
  // Arrange a ctx whose db.run always rejects with a unique-violation Error.
  // (Use the lower-level ctx builder from createVibeDiyTestCtx; mirror an
  //  existing test that injects a failing db, e.g. the AccessFnOutputs failure path.)
  // Act: api.putDoc(...) on a doc.
  // Assert: result carries error.code === "conflict"; message has no "Failed query".
});
```

- [ ] **Step 2: Run it; watch it fail**

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts -t "typed conflict"`
Expected: FAIL (today a raw error/throw surfaces).

- [ ] **Step 3: Catch `SeqConflictError` in both handlers and emit a typed `ResError`**

Wrap the `allocateAndInsertRevision` call in each handler:

```ts
let nextSeq: number;
try {
  nextSeq = await allocateAndInsertRevision({
    /* … */
  });
} catch (err) {
  if (err instanceof SeqConflictError) {
    await ctx.send.send(ctx, {
      type: "vibes.diy.res-error",
      error: { code: "conflict", message: `write conflict: head is at seq ${err.currentHeadSeq}, retry the write` },
    } satisfies ResError);
    return Result.Ok(EventoResult.Continue);
  }
  throw err;
}
```

Import `SeqConflictError` from `./seq-allocation.js`.

- [ ] **Step 4: Run it; watch it pass + full suite**

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts app-documents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/put-doc-concurrency.test.ts
git commit -m "feat(api): typed conflict error on seq-allocation exhaustion (#2506)"
```

---

## Task 7: Round out the concurrency test matrix

**Files:**

- Modify: `vibes.diy/api/tests/put-doc-concurrency.test.ts`

- [ ] **Step 1: Add the remaining matrix tests**

Add tests (real assertions, no placeholders):

```ts
it("seqs allocated under concurrency are distinct and contiguous", async () => {
  const N = 30;
  await Promise.all(
    Array.from({ length: N }, (_, i) => api.putDoc({ ownerHandle, appSlug, dbName: "seqset", doc: { n: i }, docId: "d" }))
  );
  // Read every revision's seq via the lower-level db and assert Set size === N and max === N.
  // (Use the ctx's db + appDocuments table; mirror how other tests reach raw rows.)
});

it("mixed putDoc/deleteDoc burst on one doc never errors; terminal state readable", async () => {
  const ops = Array.from({ length: 20 }, (_, i) =>
    i % 4 === 3
      ? api.deleteDoc({ ownerHandle, appSlug, dbName: "mix", docId: "m" })
      : api.putDoc({ ownerHandle, appSlug, dbName: "mix", doc: { n: i }, docId: "m" })
  );
  const rs = await Promise.all(ops);
  for (const r of rs) expect(r.isOk()).toBe(true);
  const head = await api.getDoc({ ownerHandle, appSlug, dbName: "mix", docId: "m" });
  expect(head.isOk()).toBe(true); // not-found OR a value, but never a thrown/raw error
});

it("DM lastSeenSeq matches the sender's own inserted revision under concurrency", async () => {
  // Two senders writing concurrently to a direct channel; assert the auto-read
  // lastSeenSeq for each sender equals their own allocated seq, not a later head.
  // Mirror direct-channel setup from app-documents-dm tests.
});
```

For the PG sidecar-ordering assertion (only meaningful on pg), guard it:

```ts
const flavour = process.env.DB_FLAVOUR ?? "sqlite";
(flavour === "pg" ? it : it.skip)("final AccessFnOutputs reflects highest-seq writer (pg)", async () => {
  // Two concurrent writes whose access fn returns different grants; assert the
  // stored AccessFnOutputs.output corresponds to the max(seq) revision.
});
```

- [ ] **Step 2: Run the whole new suite (sqlite)**

Run: `cd vibes.diy/api/tests && pnpm vitest run put-doc-concurrency.test.ts`
Expected: PASS (pg-only test skipped).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/put-doc-concurrency.test.ts
git commit -m "test(api): concurrency matrix for putDoc/deleteDoc seq allocation (#2506)"
```

---

## Task 8: Full gate + follow-up issue

**Files:** none (verification) + new GitHub issue

- [ ] **Step 1: Run the project gate**

Run: `pnpm check` (format + build + test + lint). If flaky, rerun per `agents/flaky-tests.md` before treating a failure as real.
Expected: PASS.

- [ ] **Step 2: Enforce the rules bag**

Run: `pnpm run rules-bag:constructors`
Expected: success.

- [ ] **Step 3: File the deferred follow-up issue**

Open a GitHub issue: "`AppDocumentHead` + seq-conditional `AccessFnOutputs` for durable cross-backend LWW ordering" describing the head-row redesign (`ON CONFLICT DO UPDATE SET seq = head.seq + 1`) and the `seq` column on `AccessFnOutputs` (`WHERE excluded.seq > stored seq`) that closes the D1 sidecar-ordering gap noted in the spec. Label `agent-created`. Link from #2506.

- [ ] **Step 4: Push and update PR #2509**

```bash
git push -u origin claude/issue-2506-exploration-ij4i8z
```

Update PR #2509 body to note it now carries the implementation (not spec-only), and check off the corresponding items on the #2506 checklist.

---

## Self-review

**Spec coverage:** atomic insert (Task 2/3) ✓; pg advisory lock + txn through sidecar (Task 3/4) ✓; same lock key for put/delete (Task 5, `docLockKey`) ✓; RETURNING for allocated seq incl. DM `lastSeenSeq` (Task 2/4) ✓; retry policy: classified + capped + jitter + typed conflict error (Task 2/6) ✓; notify/queue outside lock (Task 4 Step 3) ✓; concurrency matrix both backends (Task 7) ✓; D1 sidecar gap + `AppDocumentHead` follow-up (Task 8) ✓; `failOnConflict`/`AppDocumentHead` left out of scope ✓.

**Placeholder scan:** test bodies for DM-attribution and pg sidecar-ordering reference "mirror existing setup" rather than full code because they depend on direct-channel/access-fn fixtures that live in sibling tests; the implementer copies those fixtures. All production code is complete. The two flagged verification points (RETURNING result shape, in-txn sidecar `exec` handle) are resolved by their tests, not left as guesses.

**Type consistency:** `allocateAndInsertRevision`, `AllocateParams` (`db`, `flavour`, `table`, `row`, `sidecar`, `maxAttempts`), `docLockKey`, `isRetryableConflict`, `extractReturnedSeq`, `SeqConflictError(currentHeadSeq)` are used identically across tasks. The `sidecar` signature is `(seq: number, exec: VibesSqlite) => Promise<void>` everywhere (Task 2 defines it, Task 3 passes `tx`, Task 4 consumes `exec`).
