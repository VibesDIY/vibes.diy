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
  readonly runId?: string; // generate-operation id; null when absent (#2616)
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

// jsonb binding: serialize to JSON text on both flavours, casting to ::jsonb on
// pg. We must NOT interpolate a bare JS value as `sql`${value}`` here, because
// `fileSystem` and `meta` are ARRAYS and drizzle expands an interpolated array
// into a parenthesized parameter list — `($1,$2,...)` for a populated array and
// `()` for an empty one. That `()` produced a pg "syntax error at or near ')'"
// on every new-app INSERT (an empty `meta` array is the common case). The
// AppDocuments sibling (`seq-allocation.ts`) never hit this only because its
// jsonb value (`row.data`) is a single object, never an array. SQLite was
// unaffected because it already serialized via JSON.stringify. (#2612)
function jsonParam(flavour: DBFlavour, value: unknown) {
  return flavour === "pg" ? sql`${JSON.stringify(value)}::jsonb` : sql`${JSON.stringify(value)}`;
}

// Match the row whose existence makes a new release a duplicate: same
// (appSlug, userId, ownerHandle) AND either the same fsId (clean-stream dedup)
// OR — when this writer carries one — the same runId (one release per generate
// operation, #2616). Rechecked INSIDE the lock as one statement so a racing
// writer can't append a second row for an fsId/runId the first just committed.
function existsByFsIdOrRunId(row: AppReleaseRow) {
  const runClause = row.runId == null ? sql`` : sql` OR "runId"=${row.runId}`;
  return sql`SELECT 1 FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND ("fsId"=${row.fsId}${runClause})`;
}

/**
 * Atomic INSERT-if-absent. `HAVING NOT EXISTS(...)` suppresses the single
 * aggregate result row (and thus the insert + RETURNING) when a row already
 * carries this fsId (or, for a generate operation, this runId), so under the
 * per-(user,app) advisory lock (pg) or the global write lock (sqlite) a
 * duplicate-fsId/-runId release can never be appended. When it does insert,
 * `COALESCE(MAX("releaseSeq"),0)+1` allocates the next seq.
 */
export function buildInsertIfAbsent(p: AllocateAppParams) {
  const { row, flavour } = p;
  return sql`
    INSERT INTO ${TABLE} ("appSlug","userId","userSlug","releaseSeq","fsId","runId","env","fileSystem","meta","mode","created")
    SELECT ${row.appSlug}, ${row.userId}, ${row.ownerHandle},
           COALESCE(MAX("releaseSeq"),0)+1,
           ${row.fsId}, ${row.runId ?? null}, ${jsonParam(flavour, row.env)}, ${jsonParam(flavour, row.fileSystem)},
           ${jsonParam(flavour, row.meta)}, ${row.mode}, ${row.created}
    FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
    HAVING NOT EXISTS (${existsByFsIdOrRunId(row)})
    RETURNING "releaseSeq"
  `;
}

// Read the existing release for this run (to report its seq after the insert is
// suppressed by the runId clause). runId is the promptId — unique per generate
// operation — so this resolves the single release the dev publish + production
// push collapse into, regardless of fsId drift.
function buildSelectByRunId(row: AppReleaseRow) {
  return sql`SELECT "releaseSeq" FROM ${TABLE}
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND "runId"=${row.runId}
    ORDER BY "releaseSeq" DESC
    LIMIT 1`;
}

// Reconcile this run's release in place: repoint it at this writer's files/env
// and resolve the mode, all in ONE atomic statement so the production-wins rule
// holds regardless of read timing under sqlite's global write lock. The CASE
// keeps production terminal (production || incoming-production => production),
// and the `NOT (mode='production' AND incoming='dev')` guard makes a delayed dev
// publish a no-op against a finalized production row rather than regressing it.
function buildReconcileRunRow(row: AppReleaseRow, flavour: DBFlavour) {
  return sql`UPDATE ${TABLE}
    SET "fsId"=${row.fsId}, "env"=${jsonParam(flavour, row.env)},
        "fileSystem"=${jsonParam(flavour, row.fileSystem)},
        "mode"=CASE WHEN "mode"='production' OR ${row.mode}='production' THEN 'production' ELSE 'dev' END
    WHERE "appSlug"=${row.appSlug} AND "userId"=${row.userId}
      AND "userSlug"=${row.ownerHandle} AND "runId"=${row.runId}
      AND NOT ("mode"='production' AND ${row.mode}='dev')`;
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
  // 1. Append a fresh release only if no row carries this fsId (or this runId)
  //    yet. The runId clause makes a single generate operation — server dev
  //    publish + CLI production push — collapse into ONE release even when their
  //    file sets (and thus fsId) diverge (#2616).
  const inserted = normalizeRows(await runReturning(exec, flavour, buildInsertIfAbsent(p)));
  if (inserted.length > 0 && inserted[0].releaseSeq != null) {
    return Number(inserted[0].releaseSeq);
  }
  // 2a. Insert suppressed by an existing same-run row -> reconcile it in place
  //     (atomic; production stays terminal, a late dev publish no-ops). The
  //     SELECT only reports the seq; correctness lives in the UPDATE statement.
  if (p.row.runId != null) {
    const existingRun = normalizeRows(await runReturning(exec, flavour, buildSelectByRunId(p.row)));
    if (existingRun.length > 0 && existingRun[0].releaseSeq != null) {
      await runReturning(exec, flavour, buildReconcileRunRow(p.row, flavour));
      return Number(existingRun[0].releaseSeq);
    }
  }
  // 2b. fsId already present -> dedup. A production push that finds a committed
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

// ── Publish (#2772 D2) ─────────────────────────────────────────────────────
//
// Publishing must make the chosen content the served public latest. The
// entry-point + `selectLatestAppPerSlug` pick the HIGHEST production
// `releaseSeq`, so flipping a row's mode in place keeps its old seq and an
// older `fsId` would still be out-ranked (Codex review). Instead, publish MINTS
// a NEW top-of-stack production release (`releaseSeq = MAX+1`) carrying the
// chosen content — and does NOT demote the old production (it stays as history;
// the new highest-seq simply wins). Idempotent: when the chosen content is
// already the highest production, it's a no-op success ("up to date"), never a
// duplicate row.

export interface MintProductionParams {
  db: VibesSqlite;
  flavour: DBFlavour;
  appSlug: string;
  userId: string;
  ownerHandle: string;
  created: string;
  // Explicit version to publish ("publish a specific version"). Absent = the
  // owner's LATEST row, resolved INSIDE the lock so a concurrent codegen write
  // can't change the target between selection and mint (Codex review).
  fsId?: string;
}

export interface MintProductionResult {
  readonly released: boolean; // false = idempotent no-op (content already top production)
  readonly releaseSeq: number;
  readonly fsId: string; // the content that is now (or was already) the served production
}

// The per-(appSlug, userId, ownerHandle) scope predicate, reused across the
// subqueries so the source pick, the MAX+1, and the idempotency guard all agree.
function appScope(p: MintProductionParams) {
  return sql`"appSlug"=${p.appSlug} AND "userId"=${p.userId} AND "userSlug"=${p.ownerHandle}`;
}

// The single releaseSeq identifying the source row whose content gets published:
// the explicit fsId (its highest-seq carrier) or the owner's latest row across
// modes (newest created, releaseSeq tiebreak). releaseSeq is unique per
// (appSlug, userId), so this pins exactly one row.
function buildSourceSeq(p: MintProductionParams) {
  if (p.fsId != null) {
    return sql`SELECT "releaseSeq" FROM ${TABLE} WHERE ${appScope(p)} AND "fsId"=${p.fsId} ORDER BY "releaseSeq" DESC LIMIT 1`;
  }
  return sql`SELECT "releaseSeq" FROM ${TABLE} WHERE ${appScope(p)} ORDER BY "created" DESC, "releaseSeq" DESC LIMIT 1`;
}

/**
 * Publish as ONE atomic statement: resolve the source row, allocate
 * `MAX("releaseSeq")+1`, copy the source content into a new `production` row —
 * unless the source is ALREADY the highest production (`NOT EXISTS` idempotency
 * guard), in which case nothing is inserted. Resolving the source + the no-op
 * predicate INSIDE the insert (rather than a separate read) makes the common
 * "publish latest dev" target atomic and makes SQLite double-taps converge
 * (Codex review): the source content is copied column-to-column in SQL, never
 * carried as a stale pre-read. RETURNING reports the published fsId + seq.
 */
function buildPublishInsert(p: MintProductionParams) {
  return sql`
    INSERT INTO ${TABLE} ("appSlug","userId","userSlug","releaseSeq","fsId","runId","env","fileSystem","meta","mode","created")
    SELECT src."appSlug", src."userId", src."userSlug",
           (SELECT COALESCE(MAX("releaseSeq"),0)+1 FROM ${TABLE} WHERE ${appScope(p)}),
           src."fsId", src."runId", src."env", src."fileSystem", src."meta", 'production', ${p.created}
    FROM ${TABLE} src
    WHERE ${appScope(p)} AND src."releaseSeq" = (${buildSourceSeq(p)})
      AND NOT EXISTS (
        SELECT 1 FROM ${TABLE} top
        WHERE top."appSlug"=${p.appSlug} AND top."userId"=${p.userId} AND top."userSlug"=${p.ownerHandle}
          AND top."mode"='production' AND top."fsId"=src."fsId"
          AND top."releaseSeq" = (SELECT MAX("releaseSeq") FROM ${TABLE} WHERE ${appScope(p)} AND "mode"='production')
      )
    RETURNING "releaseSeq","fsId"
  `;
}

/** The current top production (fsId + seq) — only read to REPORT a no-op result. */
function buildSelectTopProduction(p: MintProductionParams) {
  return sql`SELECT "releaseSeq","fsId" FROM ${TABLE}
    WHERE ${appScope(p)} AND "mode"='production' ORDER BY "releaseSeq" DESC LIMIT 1`;
}

async function mintOrNoop(exec: VibesSqlite, flavour: DBFlavour, p: MintProductionParams): Promise<MintProductionResult> {
  const inserted = normalizeRows(await runReturning(exec, flavour, buildPublishInsert(p)));
  if (inserted.length > 0 && inserted[0].releaseSeq != null) {
    return { released: true, releaseSeq: Number(inserted[0].releaseSeq), fsId: String(inserted[0].fsId) };
  }
  // No insert → the source was already the highest production (idempotent no-op).
  // Re-read the top purely to report its fsId/seq; correctness lives in the insert.
  const top = normalizeRows(await runReturning(exec, flavour, buildSelectTopProduction(p)));
  if (top.length > 0 && top[0].releaseSeq != null) {
    return { released: false, releaseSeq: Number(top[0].releaseSeq), fsId: String(top[0].fsId) };
  }
  throw new Error(`publish mint: nothing inserted and no top production for ${p.appSlug}`);
}

/**
 * Mint a new top-of-stack production release for the chosen content (or no-op
 * when it's already the highest production). Serializes on the SAME
 * per-(user, app) advisory lock as `allocateAndInsertApp` (pg) — so a concurrent
 * codegen write either commits before (and is seen by the source pick) or waits;
 * on SQLite the single insert statement runs under the global write lock. Either
 * way the source selection + MAX+1 + idempotency are atomic.
 */
export async function mintProductionRelease(p: MintProductionParams): Promise<MintProductionResult> {
  if (p.flavour === "pg") {
    const key = appReleaseLockKey(p.userId, p.appSlug);
    const db = p.db as unknown as { transaction: <T>(fn: (tx: VibesSqlite) => Promise<T>) => Promise<T> };
    return db.transaction(async (tx) => {
      await (tx as unknown as { execute: (s: unknown) => Promise<unknown> }).execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
      );
      return mintOrNoop(tx, "pg", p);
    });
  }
  const attempts = 5;
  for (let i = 0; i < attempts; i++) {
    try {
      return await mintOrNoop(p.db, p.flavour, p);
    } catch (err) {
      if (!isRetryableConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (8 << i))));
    }
  }
  throw new SeqConflictError(0);
}
