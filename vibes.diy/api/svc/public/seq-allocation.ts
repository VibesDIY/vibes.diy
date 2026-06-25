import { and, eq, sql } from "drizzle-orm";
import type { DBFlavour, VibesApiTables, VibesSqlite } from "@vibes.diy/api-sql";

// Centralized seq allocation for the append-only AppDocuments log (issue #2506).
//
// The per-doc `seq` is the version counter; "current" is `max(seq)`. Allocating
// it with a separate `SELECT max(seq)` then `INSERT` races: two overlapping
// writers read the same max, compute the same next seq, and the second insert
// violates the primary key. This module allocates seq atomically in a single
// `INSERT … SELECT MAX+1 … RETURNING seq` statement, serializes same-doc writers
// on Postgres with a per-doc advisory lock, and surfaces a typed conflict error
// instead of a raw SQL string on the (essentially unreachable) exhaustion path.

/**
 * Stable per-doc key so putDoc and deleteDoc serialize on the SAME advisory
 * lock. JSON-encodes the (owner, app, db, docId) tuple so distinct docs can
 * never collide on one lock (quoting disambiguates component boundaries).
 *
 * It must stay NUL-free: this key is sent as a text bind param to
 * `hashtextextended($1, 0)`, and Postgres rejects a 0x00 byte in text with
 * SQLSTATE 22021 ("invalid byte sequence for encoding UTF8: 0x00"). The original
 * separator was a literal NUL (chosen because it cannot appear in these
 * identifiers), which made every pg write fail at the advisory-lock query. JSON
 * escapes any NUL in the inputs to the six ASCII chars backslash-u-0-0-0-0, so
 * the encoded key never carries a raw NUL byte. See issue #2557.
 */
export function docLockKey(ownerHandle: string, appSlug: string, dbName: string, docId: string): string {
  return JSON.stringify([ownerHandle, appSlug, dbName, docId]);
}

/** Typed terminal conflict — thrown only when bounded retries are exhausted. */
export class SeqConflictError extends Error {
  constructor(public readonly currentHeadSeq: number) {
    super("seq conflict: concurrent writes exhausted retries");
    this.name = "SeqConflictError";
  }
}

/**
 * True for the unique/PK-violation (and pg serialization) errors we retry.
 *
 * drizzle wraps driver errors in a generic `DrizzleQueryError` whose message is
 * `"Failed query: insert into ..."` and carries the real driver error on
 * `.cause` — so a message-only check on the top-level error would MISS a real PK
 * collision and throw it raw. We walk the cause chain and check structured error
 * codes (pg `23505`, sqlite/libsql `SQLITE_CONSTRAINT*`) as well as message text.
 */
export function isRetryableConflict(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 5; depth++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    const code = String(e.code ?? "").toUpperCase();
    if (code === "23505" || code.includes("CONSTRAINT") || code.includes("BUSY")) return true; // pg unique_violation; sqlite/libsql SQLITE_CONSTRAINT* / SQLITE_BUSY
    const msg = String(e.message ?? "").toLowerCase();
    if (
      msg.includes("unique") ||
      msg.includes("primary key") ||
      msg.includes("constraint failed") || // sqlite
      msg.includes("duplicate key") || // pg
      msg.includes("could not serialize") || // pg serialization failure
      msg.includes("database is locked") || // sqlite/libsql write-lock contention (skipIf txn path)
      msg.includes("busy") // sqlite/libsql SQLITE_BUSY
    ) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

/**
 * Render a drizzle error's full cause-chain into one human-readable line.
 *
 * drizzle wraps the driver error as `DrizzleQueryError("Failed query: insert
 * into ...")` and hangs the REAL pg/sqlite error — the one carrying the SQLSTATE
 * code (`23505`), constraint name, and reason ("duplicate key value violates
 * unique constraint") — off `.cause`. Both `String(err)` and `JSON.stringify(err)`
 * drop that cause, so a unique-violation reached the CLI as an opaque "Failed
 * query: insert into Apps ..." with no reason at all (#2612). Walk the chain and
 * append each layer's code + message + constraint so the real cause is visible.
 */
export function formatDbErrorChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 6; depth++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown; constraint?: unknown };
    const code = e.code != null && e.code !== "" ? `[${String(e.code)}] ` : "";
    const constraint = e.constraint != null && e.constraint !== "" ? ` (constraint: ${String(e.constraint)})` : "";
    const msg = typeof e.message === "string" ? e.message : depth === 0 ? String(cur) : "";
    const line = `${code}${msg}${constraint}`.trim();
    if (line) parts.push(line);
    cur = e.cause;
  }
  return parts.length > 0 ? parts.join(" <- ") : String(err);
}

/** Normalize the RETURNING result row across drivers into the allocated seq. */
export function extractReturnedSeq(result: unknown): number {
  const rows = (result as { rows?: { seq: unknown }[] } | undefined)?.rows ?? (result as { seq: unknown }[] | undefined);
  const raw = Array.isArray(rows) ? rows[0]?.seq : (rows as { seq?: unknown } | undefined)?.seq;
  const seq = Number(raw);
  if (!Number.isFinite(seq)) {
    throw new Error(`could not extract returned seq from result: ${JSON.stringify(result)}`);
  }
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
   * Runs inside the critical section (same txn, advisory lock held on pg / write
   * txn on sqlite) BEFORE the insert, against the SERIALIZED current head — the
   * in-transaction db handle is passed so the read sees committed concurrent
   * writers. Return true to absorb this write as a no-op: the insert and sidecar
   * are skipped and the call resolves with `{ inserted: false }` and the current
   * head seq. Used by putDoc for the content-identical no-op (#2644); the in-lock
   * recheck is what makes it race-safe (a concurrent write that moved the head
   * makes the content differ, so this write proceeds instead of dropping).
   */
  skipIf?: (exec: VibesSqlite) => Promise<boolean>;
  /**
   * Runs inside the PG critical section (same txn, advisory lock held) after the
   * insert. Receives the allocated seq and the in-transaction db handle (`tx` on
   * pg, `db` on sqlite/D1) — the sidecar MUST use this handle so its upsert is
   * part of the same transaction on pg. Use for the AccessFnOutputs sidecar.
   */
  sidecar?: (seq: number, exec: VibesSqlite) => Promise<void>;
  maxAttempts?: number;
}

/** Result of an allocation: the head seq, and whether a revision was inserted
 * (false when a `skipIf` predicate absorbed the write as a no-op). */
export interface AllocateResult {
  seq: number;
  inserted: boolean;
}

const TABLE = sql.raw(`"AppDocuments"`); // physical table name (schema maps ownerHandle -> "userSlug")

/** Build the atomic INSERT … SELECT MAX+1 … RETURNING seq statement. */
function buildAtomicInsert(p: AllocateParams) {
  const { row, flavour } = p;
  // jsonb binding diverges: pg takes the object, sqlite takes serialized text.
  const dataParam = flavour === "pg" ? sql`${row.data}` : sql`${JSON.stringify(row.data)}`;
  return sql`
    INSERT INTO ${TABLE} ("userSlug","appSlug","dbName","docId","seq","userId","data","deleted","created")
    SELECT ${row.ownerHandle}, ${row.appSlug}, ${row.dbName}, ${row.docId},
           COALESCE(MAX("seq"),0)+1, ${row.userId}, ${dataParam}, ${row.deleted}, ${row.created}
    FROM ${TABLE}
    WHERE "userSlug"=${row.ownerHandle} AND "appSlug"=${row.appSlug}
      AND "dbName"=${row.dbName} AND "docId"=${row.docId}
    RETURNING "seq"
  `;
}

function runReturning(db: VibesSqlite, flavour: DBFlavour, stmt: ReturnType<typeof sql>): Promise<unknown> {
  // pg: db.execute({rows}); sqlite/libsql/d1: db.run(...).rows
  if (flavour === "pg") {
    return (db as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(stmt);
  }
  return (db as unknown as { run: (s: unknown) => Promise<unknown> }).run(stmt);
}

/** Max(seq) for this doc, read through the given executor (the in-txn handle
 * when inside the critical section, so it sees committed concurrent writers). */
async function headSeqWith(exec: VibesSqlite, p: AllocateParams): Promise<number> {
  const r = await exec
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

function currentHeadSeq(p: AllocateParams): Promise<number> {
  return headSeqWith(p.db, p);
}

function asTxRunner(db: VibesSqlite) {
  return db as unknown as { transaction: <T>(fn: (tx: VibesSqlite) => Promise<T>) => Promise<T> };
}

/**
 * SQLite/D1 path: the single atomic statement runs under SQLite's global write
 * lock, so MAX(seq) always sees committed rows and the insert never collides.
 * The bounded retry is a safety net for any driver that does not serialize.
 *
 * When a `skipIf` predicate is supplied the read+decision+insert must be one
 * serialized unit, so that path runs inside a write transaction and a retry
 * re-evaluates skipIf against the now-current head (so a concurrent write that
 * moved the head is never silently no-op'd over). The fast path is unchanged.
 */
async function allocateSqlite(p: AllocateParams): Promise<AllocateResult> {
  const attempts = p.maxAttempts ?? 3;
  for (let i = 0; i < attempts; i++) {
    try {
      if (p.skipIf) {
        const skipIf = p.skipIf;
        return await asTxRunner(p.db).transaction(async (tx) => {
          if (await skipIf(tx)) return { seq: await headSeqWith(tx, p), inserted: false };
          const seq = extractReturnedSeq(await runReturning(tx, p.flavour, buildAtomicInsert(p)));
          if (p.sidecar) await p.sidecar(seq, tx);
          return { seq, inserted: true };
        });
      }
      const seq = extractReturnedSeq(await runReturning(p.db, p.flavour, buildAtomicInsert(p)));
      if (p.sidecar) await p.sidecar(seq, p.db); // best-effort ordering on D1 (see spec)
      return { seq, inserted: true };
    } catch (err) {
      if (!isRetryableConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (8 << i)))); // jittered backoff
    }
  }
  throw new SeqConflictError(await currentHeadSeq(p));
}

/**
 * Postgres path: a per-doc advisory lock serializes same-doc writers (O(N)), and
 * the transaction wraps the insert + sidecar so the highest-seq writer's grant
 * state lands last. Under the lock the insert never collides, so no retry loop.
 * A `skipIf` predicate runs here too — inside the lock, so its head read is
 * serialized against every other same-doc writer (#2644).
 */
async function allocatePg(p: AllocateParams): Promise<AllocateResult> {
  const key = docLockKey(p.row.ownerHandle, p.row.appSlug, p.row.dbName, p.row.docId);
  return asTxRunner(p.db).transaction(async (tx) => {
    await (tx as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    );
    if (p.skipIf && (await p.skipIf(tx))) {
      return { seq: await headSeqWith(tx, p), inserted: false };
    }
    const seq = extractReturnedSeq(await runReturning(tx, "pg", buildAtomicInsert(p)));
    if (p.sidecar) await p.sidecar(seq, tx); // in-txn → ordered LWW on pg
    return { seq, inserted: true };
  });
}

/**
 * Allocate the next seq for this doc and insert the revision atomically.
 * Resolves with `{ inserted: false }` (no revision written) when a `skipIf`
 * predicate absorbs the write as a no-op.
 */
export async function allocateAndInsertRevision(p: AllocateParams): Promise<AllocateResult> {
  return p.flavour === "pg" ? allocatePg(p) : allocateSqlite(p);
}
