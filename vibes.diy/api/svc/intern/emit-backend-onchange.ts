import { and, eq, lt, desc } from "drizzle-orm";
import { parseBackendJsMode } from "@vibes.diy/vibe-runtime/backend-executor.js";
import type { EvtBackendOnChange } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";
import { onChangeEmitDecision } from "./backend-onchange-policy.js";

export interface EmitBackendOnChangeInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  /** The committed revision seq (from `allocateAndInsertRevision`). */
  readonly seq: number;
  /** true ⇒ tombstone (deleteDoc); false ⇒ create/update (putDoc). */
  readonly deleted: boolean;
  /** The committed document (the new revision's data; `{}` for a tombstone). */
  readonly doc: unknown;
  /**
   * Loop-guard generation of the write that caused this commit. 0 for a frontend
   * write (no backend origin); a backend `ctx.db.put` (B6) carries its handler's
   * generation. Read defensively from the write request so B6's wiring activates
   * the guard without a B5 change.
   */
  readonly originDepth: number;
  /** The writer's user id, captured for the B6 identity seam (unused in B5). */
  readonly writerUserId?: string | null;
}

/**
 * Emit a backend.js `onChange` event after a document write commits (#2856 B5).
 * Shared by `putDocEvento` (create/update) and `deleteDocEvento` (tombstone).
 *
 * **Dark by default:** when `BACKEND_JS` is not `loader`, this returns immediately —
 * no predecessor read, no enqueue — so writes cost nothing while the feature is off.
 *
 * **Loop-guarded:** suppresses emission once the source write is at
 * `MAX_ONCHANGE_DEPTH` (dormant in B5 — handlers can't write yet — but wired + tested).
 *
 * **Fire-and-forget:** never throws and never blocks the write. An enqueue failure is
 * logged at `error` and counted (`backend_onchange_enqueue_failed`), not swallowed
 * silently (Charlie) — the at-most-once commit→enqueue gap stays observable.
 *
 * `oldDoc` is the **committed predecessor** (the highest seq below this commit for the
 * docId), read after commit to avoid the racy pre-read of the head (Codex). A
 * tombstone or absent predecessor ⇒ `oldDoc = null` (the doc didn't logically exist).
 */
export async function emitBackendOnChange(vctx: VibesApiSQLCtx, input: EmitBackendOnChangeInput): Promise<void> {
  if (parseBackendJsMode(vctx.params.vibes.env.BACKEND_JS) === "off") {
    return;
  }

  const decision = onChangeEmitDecision(input.originDepth);
  if (!decision.emit) {
    vctx.logger.Warn().Str("docId", input.docId).Uint64("depth", input.originDepth).Msg("backend onChange suppressed at depth cap");
    return;
  }

  // The write has ALREADY committed — nothing below may fail it. Wrap the whole
  // side effect (predecessor read AND enqueue) so any failure — a DB read error,
  // not just an enqueue error — is swallowed + logged, never propagated (Charlie).
  try {
    // Committed predecessor → oldDoc. A tombstone/absent predecessor reads as null.
    const tDocs = vctx.sql.tables.appDocuments;
    const prev = await vctx.sql.db
      .select({ data: tDocs.data, deleted: tDocs.deleted })
      .from(tDocs)
      .where(
        and(
          eq(tDocs.ownerHandle, input.ownerHandle),
          eq(tDocs.appSlug, input.appSlug),
          eq(tDocs.dbName, input.dbName),
          eq(tDocs.docId, input.docId),
          lt(tDocs.seq, input.seq)
        )
      )
      .orderBy(desc(tDocs.seq))
      .limit(1)
      .then((r) => r[0]);
    const oldDoc = prev && prev.deleted !== 1 ? prev.data : null;

    const payload: EvtBackendOnChange = {
      type: "vibes.diy.evt-backend-onChange",
      ownerHandle: input.ownerHandle,
      appSlug: input.appSlug,
      dbName: input.dbName,
      docId: input.docId,
      seq: input.seq,
      deleted: input.deleted,
      doc: input.doc,
      oldDoc,
      depth: decision.depth,
      writerUserId: input.writerUserId ?? null,
    };

    await vctx.postQueue({ payload, tid: "queue-event", src: "emitBackendOnChange", dst: "vibes-service", ttl: 1 });
  } catch (err) {
    // Make the loss visible (Charlie): a systemic emit/enqueue outage is a stream
    // of dropped onChange events, observable here rather than silent.
    vctx.logger.Error().Err(err).Str("docId", input.docId).Msg("backend_onchange_enqueue_failed");
  }
}
