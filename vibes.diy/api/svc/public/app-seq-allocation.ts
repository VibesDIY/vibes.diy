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

/** Build the atomic INSERT … SELECT MAX("releaseSeq")+1 … RETURNING releaseSeq statement. */
function buildAtomicInsert(p: AllocateAppParams) {
  const { row, flavour } = p;
  return sql`
    INSERT INTO ${TABLE} ("appSlug","userId","userSlug","releaseSeq","fsId","env","fileSystem","meta","mode","created")
    SELECT ${row.appSlug}, ${row.userId}, ${row.ownerHandle},
           COALESCE(MAX("releaseSeq"),0)+1,
           ${row.fsId}, ${jsonParam(flavour, row.env)}, ${jsonParam(flavour, row.fileSystem)},
           ${jsonParam(flavour, row.meta)}, ${row.mode}, ${row.created}
    FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
    RETURNING "releaseSeq"
  `;
}

function runReturning(db: VibesSqlite, flavour: DBFlavour, stmt: ReturnType<typeof sql>): Promise<unknown> {
  // pg: db.execute({rows}); sqlite/libsql/d1: db.run(...).rows
  if (flavour === "pg") {
    return (db as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(stmt);
  }
  return (db as unknown as { run: (s: unknown) => Promise<unknown> }).run(stmt);
}

/** Normalize the RETURNING result row across drivers into the allocated releaseSeq. */
export function extractReturnedReleaseSeq(result: unknown): number {
  const rows =
    (result as { rows?: { releaseSeq: unknown }[] } | undefined)?.rows ?? (result as { releaseSeq: unknown }[] | undefined);
  const raw = Array.isArray(rows) ? rows[0]?.releaseSeq : (rows as { releaseSeq?: unknown } | undefined)?.releaseSeq;
  const seq = Number(raw);
  if (!Number.isFinite(seq)) {
    throw new Error(`could not extract returned releaseSeq from result: ${JSON.stringify(result)}`);
  }
  return seq;
}

/**
 * SQLite/D1 path: the single atomic statement runs under SQLite's global write
 * lock, so MAX(releaseSeq) always sees committed rows and the insert never
 * collides. The bounded retry is a safety net for any driver that does not
 * serialize.
 */
async function allocateSqlite(p: AllocateAppParams): Promise<number> {
  const attempts = p.maxAttempts ?? 5;
  for (let i = 0; i < attempts; i++) {
    try {
      return extractReturnedReleaseSeq(await runReturning(p.db, p.flavour, buildAtomicInsert(p)));
    } catch (err) {
      if (!isRetryableConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (8 << i)))); // jittered backoff
    }
  }
  throw new SeqConflictError(0);
}

/**
 * Postgres path: a per-(user, app) advisory lock serializes concurrent release
 * writers, so under the lock the COALESCE(MAX+1) insert never collides and no
 * retry loop is needed.
 */
async function allocatePg(p: AllocateAppParams): Promise<number> {
  const key = appReleaseLockKey(p.row.userId, p.row.appSlug);
  const db = p.db as unknown as { transaction: <T>(fn: (tx: VibesSqlite) => Promise<T>) => Promise<T> };
  return db.transaction(async (tx) => {
    await (tx as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    );
    return extractReturnedReleaseSeq(await runReturning(tx, "pg", buildAtomicInsert(p)));
  });
}

/** Allocate the next releaseSeq for this (appSlug, userId) and insert the row atomically. */
export async function allocateAndInsertApp(p: AllocateAppParams): Promise<number> {
  return p.flavour === "pg" ? allocatePg(p) : allocateSqlite(p);
}
