import { eq } from "drizzle-orm/sql/expressions";
import { emitNotification, EmitNotificationCtx } from "./emit-notification.js";

// The slice of an EvtNewFsId payload that the publish notifier reads. A real
// EvtNewFsId (production branch) carries these fields, so the handler passes the
// payload directly.
export interface PublishNotifyInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string;
}

/**
 * Persist a `vibe-published` notification for the vibe owner and fan out the
 * live bell.
 *
 * Resolves the owner's userId from the `handleBinding` row for `ownerHandle`
 * (mirrors how the handler resolved it before). Returns silently if no binding
 * exists.
 *
 * `dedupeKey` is per-release (`fsId`), so each distinct publish notifies once
 * while event re-delivery for the same release does not double-notify. Dedupe is
 * handled entirely by `emitNotification`'s unique `(userId, dedupeKey)` index.
 */
export async function notifyVibePublished(qctx: EmitNotificationCtx, payload: PublishNotifyInput): Promise<void> {
  const usb = qctx.sql.tables.handleBinding;
  const ownerRow = await qctx.sql.db
    .select({ userId: usb.userId })
    .from(usb)
    .where(eq(usb.handle, payload.ownerHandle))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!ownerRow?.userId) return;

  await emitNotification(qctx, {
    userId: ownerRow.userId,
    notificationType: "vibe-published",
    ownerHandle: payload.ownerHandle,
    appSlug: payload.appSlug,
    body: `${payload.ownerHandle}/${payload.appSlug} was published.`,
    dedupeKey: `vibe-published:${payload.ownerHandle}/${payload.appSlug}:${payload.fsId}`,
  });
}
