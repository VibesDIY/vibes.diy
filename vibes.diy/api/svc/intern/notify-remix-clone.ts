import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { EmitNotificationCtx } from "./emit-notification.js";
import { notifyRemixSourceOwner } from "./notify-remix.js";

// The slice of an evt-remix-clone-notify payload the handler reads — the
// clone's stable identity. The row (and its `remix-of` meta) is re-loaded here
// so the queue message stays small and the notify logic lives in one place.
export interface RemixCloneNotifyInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

/**
 * Clone-path (forkApp skipChat) remix notification, driven off the queue.
 *
 * Re-loads the freshly-inserted clone row by `(ownerHandle, appSlug)` and hands
 * it to `notifyRemixSourceOwner`, which resolves the source owner from the
 * clone's `remix-of` meta and emits exactly one durable `vibe-remixed` row.
 *
 * Returns silently if the clone row no longer exists (e.g. deleted before the
 * message was processed). Dedupe is handled entirely by `emitNotification`'s
 * unique `(userId, dedupeKey)` index, so queue redelivery is naturally
 * once-only and a self-clone is a no-op.
 */
export async function notifyRemixCloneOwner(qctx: EmitNotificationCtx, payload: RemixCloneNotifyInput): Promise<void> {
  const t = qctx.sql.tables.apps;
  const row = await qctx.sql.db
    .select({
      userId: t.userId,
      ownerHandle: t.ownerHandle,
      appSlug: t.appSlug,
      meta: t.meta,
    })
    .from(t)
    .where(and(eq(t.ownerHandle, payload.ownerHandle), eq(t.appSlug, payload.appSlug)))
    .orderBy(desc(t.releaseSeq))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!row) return; // clone row gone — nothing to notify

  await notifyRemixSourceOwner(qctx, row);
}
