// Pure loop-guard policy for the backend.js onChange lane (#2856 B5). Kept
// separate from the emit site so the depth-cap decision is unit-testable on its
// own. A backend `ctx.db.put` inside `onChange` (B6) can re-enqueue another
// `onChange`; the guard bounds that chain. Two halves work together (per Charlie):
// a generation `depth` rides the onChange message, and a source tag rides the
// internal write request — so the guard can both bound the chain length AND tell a
// backend-induced write from a user write. This module is the depth half.

/**
 * Maximum onChange generation depth. A user write emits `onChange` at depth 1; a
 * handler-induced write (B6) at generation N emits at N+1, suppressed once the
 * source write is already at the cap. 4 is the launch default (Charlie).
 */
export const MAX_ONCHANGE_DEPTH = 4;

export interface OnChangeEmitDecision {
  /** Whether to enqueue an onChange for this commit. */
  readonly emit: boolean;
  /** The generation depth the enqueued message carries (only meaningful when `emit`). */
  readonly depth: number;
}

/**
 * Decide whether a committed write should emit an `onChange`, and at what
 * generation depth, given the depth of the write that caused it.
 *
 * - A **frontend** write carries no backend origin ⇒ `originDepth = 0` ⇒ emit at
 *   depth 1.
 * - A **backend** write (B6) carries its handler's generation as `originDepth`;
 *   its commit emits the next generation `originDepth + 1` — but only while the
 *   source write is below the cap. At `originDepth >= MAX_ONCHANGE_DEPTH` the chain
 *   is **suppressed** (no emit), so a self-feeding handler terminates.
 *
 * In B5 `ctx.db` throws, so `originDepth` is always 0 and every emit is depth 1 —
 * the guard is exercised by tests but never actually suppresses in production until
 * B6 enables handler writes.
 */
export function onChangeEmitDecision(originDepth: number): OnChangeEmitDecision {
  if (originDepth >= MAX_ONCHANGE_DEPTH) {
    return { emit: false, depth: originDepth };
  }
  return { emit: true, depth: originDepth + 1 };
}
