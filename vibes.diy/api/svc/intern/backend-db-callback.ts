import { exception2Result } from "@adviser/cement";
import type { BackendDbCallback, BackendDbOp, BackendDbResult } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { and, desc, eq } from "drizzle-orm";
import type { VibesSqlite } from "@vibes.diy/api-sql";
import { VibesApiSQLCtx } from "../types.js";
import { type AccessDescriptor } from "../public/access-function.js";
import { checkDocAccess } from "../public/access-helpers.js";
import { aclAllows, resolveDbAcl } from "../public/db-acl-resolver.js";
import { resolveAccessBinding } from "../public/access-binding-resolver.js";
import { resolveActiveHandle } from "../public/resolve-active-handle.js";
import { allocateAndInsertRevision, SeqConflictError } from "../public/seq-allocation.js";
import { emitBackendOnChange } from "./emit-backend-onchange.js";
import { runPutAccessGate } from "./put-access-gate.js";
import { runDeleteAccessGate } from "./delete-access-gate.js";

/**
 * The acting identity a backend write runs as (#2856 B6). Resolved HOST-SIDE per
 * trigger and bound into the db callback — never read from handler/client input:
 *
 * - `onChange` → the **original writer** (`writerUserId` off the B5 queue envelope)
 * - `fetch`    → the **session user** of the `_api` request
 * - `scheduled`→ the vibe **owner**
 *
 * `userId` drives the delete ACL gate and the stored revision's `userId`;
 * `userContext` (active handle + ownership) is what the put access-fn gate sees as
 * its `user`, mirroring the frontend write path exactly.
 */
export interface BackendWriteIdentity {
  readonly userId: string | null;
  readonly userContext: { readonly userHandle: string; readonly isOwner: boolean } | null;
}

/**
 * Resolve a `userId` into the `BackendWriteIdentity` the gate expects, the SAME
 * way `putDocEvento` does for a frontend write: the writer's ACTIVE handle
 * (`resolveActiveHandle` — defaultHandle, else any bound handle) plus `isOwner`
 * from `checkDocAccess`. `userId === null` (anonymous / unauthenticated webhook)
 * yields a null `userContext`, so the access fn must opt in via `allowAnonymous`.
 */
export async function resolveBackendWriteIdentity(
  vctx: VibesApiSQLCtx,
  input: { readonly ownerHandle: string; readonly appSlug: string; readonly userId: string | null }
): Promise<BackendWriteIdentity> {
  if (input.userId === null) {
    return { userId: null, userContext: null };
  }
  const userHandle = await resolveActiveHandle(vctx, input.userId);
  const { isOwner } = await checkDocAccess(vctx, input.userId, input.appSlug, input.ownerHandle, false);
  return { userId: input.userId, userContext: userHandle ? { userHandle, isOwner } : null };
}

/**
 * Resolve the vibe **owner**'s identity for the `scheduled` trigger. The owner's
 * `userId` comes from the handle binding (the same lookup `checkDocAccess` uses to
 * decide ownership); `userContext` is the owner handle with `isOwner: true`.
 */
export async function resolveOwnerWriteIdentity(
  vctx: VibesApiSQLCtx,
  input: { readonly ownerHandle: string; readonly appSlug: string }
): Promise<BackendWriteIdentity> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.handleBinding.userId })
    .from(vctx.sql.tables.handleBinding)
    .where(eq(vctx.sql.tables.handleBinding.handle, input.ownerHandle))
    .limit(1)
    .then((r) => r[0]);
  return { userId: binding?.userId ?? null, userContext: { userHandle: input.ownerHandle, isOwner: true } };
}

export interface BackendDbCallbackBase {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly identity: BackendWriteIdentity;
  /**
   * The TRUSTED loop-guard generation of the write that triggered this handler
   * (B5). A handler-induced `ctx.db.put` commits and emits its `onChange` at
   * `originDepth + 1`, suppressed past `MAX_ONCHANGE_DEPTH`. `0` for `fetch`/
   * `scheduled` (no onChange parent); the onChange envelope's `depth` for the
   * onChange lane. NEVER read from handler input.
   */
  readonly originDepth: number;
}

/**
 * Build the host capability backing a backend handler's `ctx.db` (#2856 B6). The
 * returned callback re-enters the EXACT production write paths a frontend write
 * uses — `put` runs the ACL/DM pre-gate + `runPutAccessGate` (access-fn →
 * grant-state → fail-closed → `AccessFnOutputs` sidecar); `delete` runs
 * `runDeleteAccessGate` (ACL/DM) + the tombstone with output-row removal — both
 * through `allocateAndInsertRevision`, the **same per-doc seq/allocator path** as
 * frontend writes (Charlie's hard requirement: single-writer-per-doc
 * serialization is preserved). Identity and loop-guard depth come from `base`,
 * never from `op`; the handler supplies only the doc/id/db.
 *
 * NB (B6 scope): the live WS fan-out a frontend write does after commit
 * (`notifyDocChanged` / `notifyViewerGrantsChanged`) is intentionally NOT
 * replicated here — backend writes are eventually consistent to live viewers via
 * sync + the onChange lane. The allow/deny + sidecar (grant) outcome — the spec's
 * write-path-parity requirement — is identical. Live fan-out is a follow-up.
 */
export function makeBackendDbCallback(vctx: VibesApiSQLCtx, base: BackendDbCallbackBase): BackendDbCallback {
  return async (op: BackendDbOp): Promise<BackendDbResult> => {
    if (op.kind === "put") {
      return handleBackendPut(vctx, base, op);
    }
    if (op.kind === "query") {
      return handleBackendQuery(vctx, base, op);
    }
    return handleBackendDelete(vctx, base, op);
  };
}

function deny(message: string, code?: string): BackendDbResult {
  return { ok: false, error: message, code };
}

// Hard cap on a backend query result. The docs cross the isolate boundary as one
// JSON body; a runaway db must not OOM the DO or the isolate. Sorted by docId for
// determinism before the cap is applied, so a capped read is at least stable.
const BACKEND_QUERY_MAX_DOCS = 2000;

/**
 * `ctx.db.query` — the backend read lane. Returns the db's latest non-deleted
 * revisions (`_id` included), gated by the SAME front-door read check
 * `queryDocsEvento` applies to a frontend read: the ACL's `read` action for the
 * acting identity. Two deliberate v1 restrictions, both fail-closed:
 *
 * - **Anonymous callers are denied** (a `fetch`-lane trigger with no session):
 *   there is no anonymous read story here yet — the frontend anonymous read runs
 *   through publicAccess gates this path doesn't replicate.
 * - **Access-fn-bound dbs are denied**: queryDocs channel-filters those docs per
 *   reader; replicating that filter here is future work, and returning UNfiltered
 *   docs would be a grant bypass. A backend that needs to read a db should keep
 *   that db on a plain ACL.
 *
 * No file-URL minting (`mintFilesUrls`): a backend handler has no session to use
 * signed URLs with; it reads raw doc data.
 */
async function handleBackendQuery(
  vctx: VibesApiSQLCtx,
  base: BackendDbCallbackBase,
  op: Extract<BackendDbOp, { kind: "query" }>
): Promise<BackendDbResult> {
  const { ownerHandle, appSlug } = base;
  const dbName = op.db;
  const userId = base.identity.userId;

  if (!userId) return deny("Access denied", "access-denied");

  const { access } = await checkDocAccess(vctx, userId, appSlug, ownerHandle, false);
  const rAcl = await resolveDbAcl(vctx, ownerHandle, appSlug, dbName);
  // Fail closed: a settings-read error must not fall back to the open default.
  if (rAcl.isErr() || !aclAllows(rAcl.Ok(), "read", access)) return deny("Access denied", "access-denied");

  // v1: no channel filtering — refuse access-fn-bound dbs outright (see docstring).
  const afbRow = await resolveAccessBinding(vctx, ownerHandle, appSlug, dbName);
  if (afbRow?.accessFnCid) {
    return deny("ctx.db.query does not support access-fn-bound databases", "access-denied");
  }

  const t = vctx.sql.tables.appDocuments;
  const rows = await vctx.sql.db
    .select({ docId: t.docId, seq: t.seq, deleted: t.deleted, data: t.data })
    .from(t)
    .where(and(eq(t.ownerHandle, ownerHandle), eq(t.appSlug, appSlug), eq(t.dbName, dbName)))
    .orderBy(t.docId, t.seq);

  // Last row per docId wins (highest seq), skip deleted — same projection as
  // queryDocsEvento.
  const latest = new Map<string, (typeof rows)[0]>();
  for (const row of rows) latest.set(row.docId, row);
  const docs: Record<string, unknown>[] = [];
  for (const row of latest.values()) {
    if (row.deleted === 1) continue;
    docs.push({ _id: row.docId, ...(row.data as Record<string, unknown>) });
    if (docs.length >= BACKEND_QUERY_MAX_DOCS) break;
  }
  return { ok: true, docs };
}

async function handleBackendPut(
  vctx: VibesApiSQLCtx,
  base: BackendDbCallbackBase,
  op: Extract<BackendDbOp, { kind: "put" }>
): Promise<BackendDbResult> {
  const { ownerHandle, appSlug } = base;
  const dbName = op.db;
  const userId = base.identity.userId;

  // Pre-gate: the db ACL's `write` action for an authenticated user (mirrors
  // putDocEvento). A backend write's ownerHandle is always the vibe owner — never
  // a `_d.` DM slug — so there is no DM branch here. Anonymous writers fall through
  // to the access-fn gate below (deny if the db has no access fn).
  if (userId) {
    const { access } = await checkDocAccess(vctx, userId, appSlug, ownerHandle, false);
    const rAcl = await resolveDbAcl(vctx, ownerHandle, appSlug, dbName);
    // Fail closed: a settings-read error must not fall back to the open default.
    if (rAcl.isErr() || !aclAllows(rAcl.Ok(), "write", access)) return deny("Access denied");
  }

  // Resolve the effective access-fn binding (named dbName beats the app-wide '*').
  const afbRow = await resolveAccessBinding(vctx, ownerHandle, appSlug, dbName);

  // Anonymous write with no access function → deny (mirrors putDocEvento).
  if (!userId && !afbRow?.accessFnCid) return deny("Access denied");
  // Fail closed: a doc bound to an access fn must NOT be written if no invoker is
  // available — never silently bypass enforcement (#2265 A2b).
  if (afbRow?.accessFnCid && !vctx.invokeAccessFn) return deny("Access function unavailable");

  const docId = op.docId ?? vctx.sthis.timeOrderedNextId().str;

  // Load the current head once (the access fn's committed `oldDoc`). A backend put
  // with no supplied id is a brand-new doc → no predecessor.
  let oldDoc: unknown | null = null;
  if (op.docId) {
    const tDocs = vctx.sql.tables.appDocuments;
    const headRow = await vctx.sql.db
      .select({ data: tDocs.data, deleted: tDocs.deleted })
      .from(tDocs)
      .where(
        and(eq(tDocs.ownerHandle, ownerHandle), eq(tDocs.appSlug, appSlug), eq(tDocs.dbName, dbName), eq(tDocs.docId, op.docId))
      )
      .orderBy(desc(tDocs.seq))
      .limit(1)
      .then((r) => r[0]);
    oldDoc = headRow?.data ?? null;
  }

  let accessResult: AccessDescriptor | undefined;
  if (afbRow?.accessFnCid && vctx.invokeAccessFn) {
    // The pure-decision access gate (source resolve → grant-state reduce →
    // invokeAccessFn → forbidden/anonymous/readability enforcement), reused
    // unchanged from the frontend path. adminMode is always false for a backend
    // write (admin-mode is a frontend connection concept).
    const gate = await runPutAccessGate(vctx, {
      ownerHandle,
      appSlug,
      dbName,
      fnCid: afbRow.accessFnCid,
      accessFnAssetUri: afbRow.accessFnAssetUri,
      accessFnDbName: afbRow.dbName,
      docId,
      doc: op.doc,
      oldDoc,
      userContext: base.identity.userContext,
      adminMode: false,
    });
    if (gate.kind === "deny") return deny(gate.message, gate.code);
    accessResult = gate.descriptor;
  }

  // Store-access-fn-output sidecar — keyed only by (owner, app, db, docId), so it
  // MUST run inside the same critical section as the seq insert (under the pg
  // advisory lock) or concurrent same-doc writes leave grants reflecting the
  // losing revision (#2506). Identical upsert shape to putDocEvento.
  const storeAccessOutput =
    accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid
      ? {
          tOutputs: vctx.sql.tables.accessFnOutputs,
          fnCid: afbRow.accessFnCid,
          descriptor: accessResult,
          outputHasGrants:
            (accessResult.members && Object.keys(accessResult.members).length > 0) ||
            (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
            (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
            (accessResult.grant?.public && accessResult.grant.public.length > 0)
              ? 1
              : 0,
        }
      : undefined;

  let grantUpsertErr: Error | undefined;
  const sidecar = storeAccessOutput
    ? async (_seq: number, exec: VibesSqlite) => {
        const rUpsert = await exception2Result(() =>
          exec
            .insert(storeAccessOutput.tOutputs)
            .values({
              ownerHandle,
              appSlug,
              dbName,
              docId,
              fnCid: storeAccessOutput.fnCid,
              output: JSON.stringify(storeAccessOutput.descriptor),
              hasGrants: storeAccessOutput.outputHasGrants,
            })
            .onConflictDoUpdate({
              target: [
                storeAccessOutput.tOutputs.ownerHandle,
                storeAccessOutput.tOutputs.appSlug,
                storeAccessOutput.tOutputs.dbName,
                storeAccessOutput.tOutputs.docId,
              ],
              set: {
                fnCid: storeAccessOutput.fnCid,
                output: JSON.stringify(storeAccessOutput.descriptor),
                hasGrants: storeAccessOutput.outputHasGrants,
              },
            })
        );
        if (rUpsert.isErr()) grantUpsertErr = rUpsert.Err();
      }
    : undefined;

  const now = new Date().toISOString();
  const t = vctx.sql.tables.appDocuments;
  let alloc: { seq: number; inserted: boolean };
  try {
    alloc = await allocateAndInsertRevision({
      db: vctx.sql.db,
      flavour: vctx.sql.flavour,
      table: t,
      row: {
        ownerHandle,
        appSlug,
        dbName,
        docId,
        userId: userId ?? "unknown",
        data: op.doc,
        deleted: 0,
        created: now,
      },
      sidecar,
    });
  } catch (err) {
    if (err instanceof SeqConflictError) {
      return deny(`write conflict: head is at seq ${err.currentHeadSeq}, retry the write`, "conflict");
    }
    throw err;
  }

  // A grant-bearing write whose sidecar upsert failed must surface as an error
  // (mirrors putDocEvento) — the revision committed but its grants didn't land.
  if (grantUpsertErr && storeAccessOutput?.outputHasGrants === 1) {
    return deny("grant storage failed — retry the write");
  }

  // Per-app onChange after commit, with the TRUSTED generation depth (B6 turns
  // B5's dormant loop-guard live). Dark unless BACKEND_JS=loader.
  await emitBackendOnChange(vctx, {
    ownerHandle,
    appSlug,
    dbName,
    docId,
    seq: alloc.seq,
    deleted: false,
    doc: op.doc,
    originDepth: base.originDepth,
    writerUserId: userId,
  });

  return { ok: true, id: docId };
}

async function handleBackendDelete(
  vctx: VibesApiSQLCtx,
  base: BackendDbCallbackBase,
  op: Extract<BackendDbOp, { kind: "delete" }>
): Promise<BackendDbResult> {
  const { ownerHandle, appSlug } = base;
  const dbName = op.db;
  const userId = base.identity.userId;
  // deleteDocEvento requires authentication (`checkAuth`); a backend delete with no
  // resolved identity (anonymous webhook) is denied, never run as a privileged op.
  if (!userId) return deny("Access denied");

  // The pure-decision delete gate (the db ACL's `delete` action; a backend
  // ownerHandle is never a `_d.` DM slug, so the gate's DM branch never fires).
  const delGate = await runDeleteAccessGate(vctx, { ownerHandle, appSlug, dbName, docId: op.docId, userId, adminMode: false });
  if (delGate.kind === "deny") return deny(delGate.message);

  // Drop the doc's stored AccessFnOutputs row in the SAME critical section as the
  // tombstone insert — that removal is what actually revokes the grant
  // (resolveGrants reduces over stored outputs). Mirrors deleteDocEvento's sidecar.
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const deleteOutputSidecar = async (_seq: number, exec: VibesSqlite) => {
    await exec
      .delete(tOutputs)
      .where(
        and(
          eq(tOutputs.ownerHandle, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, dbName),
          eq(tOutputs.docId, op.docId)
        )
      );
  };

  const now = new Date().toISOString();
  const t = vctx.sql.tables.appDocuments;
  let delAlloc: { seq: number; inserted: boolean };
  try {
    delAlloc = await allocateAndInsertRevision({
      db: vctx.sql.db,
      flavour: vctx.sql.flavour,
      table: t,
      row: { ownerHandle, appSlug, dbName, docId: op.docId, userId, data: {}, deleted: 1, created: now },
      sidecar: deleteOutputSidecar,
    });
  } catch (err) {
    if (err instanceof SeqConflictError) {
      return deny(`write conflict: head is at seq ${err.currentHeadSeq}, retry the delete`, "conflict");
    }
    throw err;
  }

  if (delAlloc.inserted) {
    await emitBackendOnChange(vctx, {
      ownerHandle,
      appSlug,
      dbName,
      docId: op.docId,
      seq: delAlloc.seq,
      deleted: true,
      doc: {},
      originDepth: base.originDepth,
      writerUserId: userId,
    });
  }

  return { ok: true, id: op.docId };
}
