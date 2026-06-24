import { eq } from "drizzle-orm/sql/expressions";
import { emitNotification, EmitNotificationCtx } from "./emit-notification.js";

// The slice of an EvtCommentPosted payload the comment notifier reads. A real
// EvtCommentPosted satisfies this, so the handler passes the payload directly.
export interface CommentNotifyInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly docId: string;
  // The commenter's userId, when carried on the event.
  readonly userId?: string;
}

/**
 * Persist a `comment-posted` notification for the vibe owner and fan out the
 * live bell.
 *
 * Resolves the owner's userId from the `handleBinding` row for `ownerHandle`.
 * Returns silently if no binding exists. `dedupeKey` is per-comment (`docId`),
 * so re-delivery of the same comment event does not double-notify. `targetRef`
 * carries the `docId` so a renderer MAY hydrate the comment, but the row renders
 * from `body` alone.
 */
export async function notifyCommentPosted(qctx: EmitNotificationCtx, payload: CommentNotifyInput): Promise<void> {
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
    notificationType: "comment-posted",
    ownerHandle: payload.ownerHandle,
    appSlug: payload.appSlug,
    body: `New comment on ${payload.ownerHandle}/${payload.appSlug}.`,
    actorUserId: payload.userId,
    targetRef: { docId: payload.docId },
    dedupeKey: `comment-posted:${payload.docId}`,
  });
}
