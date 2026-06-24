import { sql } from "drizzle-orm";
import type { DBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { isRetryableConflict, SeqConflictError } from "./seq-allocation.js";

// Atomic releaseSeq allocation for the Apps table (issue #2612).
//
// `Apps` is keyed by (appSlug, userId, releaseSeq) and a new release used to be
// written with a non-atomic `SELECT max(releaseSeq)` (checkMaxAppsPerUser) then
// `INSERT releaseSeq = max+1`. That races: a single `generate` has TWO writers
// for the same (appSlug, userId) — the server-side dev publish that runs while
// the codegen turn streams (prompt-chat-section -> ensureAppSlugItem) and the
// CLI's production push (pushFromDir -> ensureAppSlug). Both read max=0, both
// compute releaseSeq=1, and the loser hits a pg `23505` unique_violation that
// surfaced as an opaque "Failed query: insert into Apps ...".
//
// This is the same bug class `seq-allocation.ts` fixed for AppDocuments
// (#2506/#2557). We reuse its building blocks: allocate the seq inside the
// INSERT with `COALESCE(MAX+1)`, serialize same-(user,app) writers on Postgres
// with a per-key advisory lock, and fall back to a bounded jittered retry on
// SQLite/libsql (whose global write lock makes a collision essentially
// unreachable but the retry stays as a safety net).

const TABLE = sql.raw(`"Apps"`); // physical table name (schema maps ownerHandle -> "userSlug")

export interface AppReleaseRow {
  readonly appSlug: string;
  readonly userId: string;
  readonly ownerHandle: string; // persisted into the "userSlug" column
  readonly fsId: string;
  readonly env: unknown; // jsonb
  readonly fileSystem: unknown; // jsonb
  readonly meta: unknown; // jsonb
  readonly mode: string;
  readonly created: string;
}

export interface AllocateAppParams {
  db: VibesSqlite;
  flavour: DBFlavour;
  row: AppReleaseRow;
  maxAttempts?: number;
}

/**
 * Stable per-(user, app) key so the server dev-publish and the CLI
 * production-push serialize on the SAME advisory lock. Mirrors `docLockKey`:
 * JSON-encoded so component boundaries can't collide, and NUL-free so the text
 * bind param to `hashtextextended($1, 0)` never trips pg SQLSTATE 22021 (#2557).
 */
export function appReleaseLockKey(userId: string, appSlug: string): string {
  return JSON.stringify(["app-release-seq", userId, appSlug]);
}

// jsonb binding diverges: pg takes the object, sqlite takes serialized text.
function jsonParam(flavour: DBFlavour, value: unknown) {
  return flavour === "pg" ? sql`${value}` : sql`${JSON.stringify(value)}`;
}

// Match the row whose existence makes a new release a duplicate: same
// (appSlug, userId, ownerHandle, fsId). This is the fsId-dedup key the pre-lock
// `exist` check in ensureApps uses — rechecked here INSIDE the lock so a racing
// writer can't append a second row for an fsId the first writer just committed.
function existsByFsId(row: AppReleaseRow) {
  return sql`SELECT 1 FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND "fsId"=${row.fsId}`;
}

/**
 * Atomic INSERT-if-fsId-absent. `HAVING NOT EXISTS(...)` suppresses the single
 * aggregate result row (and thus the insert + RETURNING) when a row already
 * carries this fsId, so under the per-(user,app) advisory lock (pg) or the
 * global write lock (sqlite) a duplicate-fsId release can never be appended.
 * When it does insert, `COALESCE(MAX("releaseSeq"),0)+1` allocates the next seq.
 */
function buildInsertIfAbsent(p: AllocateAppParams) {
  const { row, flavour } = p;
  return sql`
    INSERT INTO ${TABLE} ("appSlug","userId","userSlug","releaseSeq","fsId","env","fileSystem","meta","mode","created")
    SELECT ${row.appSlug}, ${row.userId}, ${row.ownerHandle},
           COALESCE(MAX("releaseSeq"),0)+1,
           ${row.fsId}, ${jsonParam(flavour, row.env)}, ${jsonParam(flavour, row.fileSystem)},
           ${jsonParam(flavour, row.meta)}, ${row.mode}, ${row.created}
    FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
    HAVING NOT EXISTS (${existsByFsId(row)})
    RETURNING "releaseSeq"
  `;
}

/** Read the existing release for this fsId (to report its seq / decide an upgrade). */
function buildSelectByFsId(row: AppReleaseRow) {
  return sql`SELECT "releaseSeq", "mode" FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND "fsId"=${row.fsId}
    LIMIT 1`;
}

/**
 * Upgrade an existing dev release for this fsId to production. Idempotent (the
 * `"mode"='dev'` guard makes a repeat a no-op). Closes the Codex P2: without it,
 * a racing production push that finds a committed dev row for the same fsId would
 * leave the app stuck in dev, and get-app-by-fsid would deny public readers.
 */
function buildUpgradeToProduction(row: AppReleaseRow) {
  return sql`UPDATE ${TABLE} SET "mode"='production'
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND "fsId"=${row.fsId} AND "mode"='dev'`;
}

function normalizeRows(result: unknown): Record<string, unknown>[] {
  const rows = (result as { rows?: unknown } | undefined)?.rows ?? result;
  if (Array.isArray(rows)) return rows as Record<string, unknown>[];
  return rows ? [rows as Record<string, unknown>] : [];
}

function runReturning(db: VibesSqlite, flavour: DBFlavour, stmt: ReturnType<typeof sql>): Promise<unknown> {
  // pg: db.execute({rows}); sqlite/libsql/d1: db.run(...).rows
  if (flavour === "pg") {
    return (db as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(stmt);
  }
  return (db as unknown as { run: (s: unknown) => Promise<unknown> }).run(stmt);
}

/**
 * Insert-if-fsId-absent, else dedup (and promote dev→production). Runs on the
 * passed executor — `tx` inside the pg advisory-locked transaction, or `db`
 * under sqlite's global write lock — so the recheck and insert are atomic on
 * both flavours without a duplicate-fsId row escaping.
 *
 * Returns the releaseSeq of the row this generate operation resolves to: the
 * freshly inserted release when the fsId was new, or the existing release's seq
 * when an earlier writer already committed this fsId.
 */
async function dedupOrInsert(exec: VibesSqlite, flavour: DBFlavour, p: AllocateAppParams): Promise<number> {
  // 1. Append a fresh release only if no row carries this fsId yet.
  const inserted = normalizeRows(await runReturning(exec, flavour, buildInsertIfAbsent(p)));
  if (inserted.length > 0 && inserted[0].releaseSeq != null) {
    return Number(inserted[0].releaseSeq);
  }
  // 2. fsId already present -> dedup. A production push that finds a committed
  //    dev row for the same fsId promotes it in place (fsId-keyed promotion),
  //    rather than appending a duplicate dev+production pair (Codex P2).
  if (p.row.mode === "production") {
    await runReturning(exec, flavour, buildUpgradeToProduction(p.row));
  }
  const existing = normalizeRows(await runReturning(exec, flavour, buildSelectByFsId(p.row)));
  const seq = Number(existing[0]?.releaseSeq);
  if (!Number.isFinite(seq)) {
    throw new Error(`app dedup: fsId insert suppressed but no existing row found for ${p.row.appSlug}/${p.row.fsId}`);
  }
  return seq;
}

/**
 * SQLite/D1 path: the dedup+insert runs under SQLite's global write lock, so the
 * recheck always sees committed rows and a duplicate-fsId release can't be
 * appended. The bounded retry is a safety net for any driver that does not
 * serialize (and absorbs a PK collision between distinct-fsId concurrent writers).
 */
async function allocateSqlite(p: AllocateAppParams): Promise<number> {
  const attempts = p.maxAttempts ?? 5;
  for (let i = 0; i < attempts; i++) {
    try {
      return await dedupOrInsert(p.db, p.flavour, p);
    } catch (err) {
      if (!isRetryableConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (8 << i)))); // jittered backoff
    }
  }
  throw new SeqConflictError(0);
}

/**
 * Postgres path: a per-(user, app) advisory lock serializes concurrent release
 * writers, so under the lock the recheck-then-insert never races — neither a PK
 * collision (distinct fsId) nor a duplicate-fsId pair can occur, so no retry.
 */
async function allocatePg(p: AllocateAppParams): Promise<number> {
  const key = appReleaseLockKey(p.row.userId, p.row.appSlug);
  const db = p.db as unknown as { transaction: <T>(fn: (tx: VibesSqlite) => Promise<T>) => Promise<T> };
  return db.transaction(async (tx) => {
    await (tx as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    );
    return dedupOrInsert(tx, "pg", p);
  });
}

/**
 * Allocate the release for this (appSlug, userId): append the next releaseSeq
 * when the fsId is new, or dedup/promote in place when an earlier writer already
 * committed this fsId. Returns the resolved releaseSeq.
 */
export async function allocateAndInsertApp(p: AllocateAppParams): Promise<number> {
  return p.flavour === "pg" ? allocatePg(p) : allocateSqlite(p);
}
