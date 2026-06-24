import { eq } from "drizzle-orm/sql/expressions";
import { emitNotification, EmitNotificationCtx } from "./emit-notification.js";

// The slice of an EvtDmReceived payload the DM notifier reads. A real
// EvtDmReceived satisfies this. The DM channel handle is `channelUserSlug`
// (e.g. "_d.alice.bob"); `docId` is the per-message Firefly doc id.
export interface DmNotifyInput {
  readonly senderUserId: string;
  readonly senderUserSlug: string;
  readonly recipientUserSlug: string;
  readonly channelUserSlug: string;
  readonly docId: string;
}

/**
 * Persist a `dm-received` notification for the DM recipient and fan out the
 * live bell.
 *
 * Resolves the recipient's userId from the `handleBinding` row for
 * `recipientUserSlug` (mirrors how evt-new-fs-id resolves a handle → userId).
 * Returns silently if no binding exists.
 *
 * A DM is not a vibe, so there is no natural owner/app subject: the row stores
 * `ownerHandle = recipientUserSlug` and `appSlug = channelUserSlug` (the DM
 * channel) so the not-null columns carry meaningful values. `dedupeKey` is
 * per-message (`channelUserSlug` + `docId`), so re-delivery of the same message
 * event does not double-notify. `targetRef` links the DM thread + message for
 * optional hydration.
 */
export async function notifyDmReceived(qctx: EmitNotificationCtx, payload: DmNotifyInput): Promise<void> {
  const usb = qctx.sql.tables.handleBinding;
  const recipientRow = await qctx.sql.db
    .select({ userId: usb.userId })
    .from(usb)
    .where(eq(usb.handle, payload.recipientUserSlug))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!recipientRow?.userId) return;

  await emitNotification(qctx, {
    userId: recipientRow.userId,
    notificationType: "dm-received",
    ownerHandle: payload.recipientUserSlug,
    appSlug: payload.channelUserSlug,
    body: `New message from ${payload.senderUserSlug}.`,
    actorHandle: payload.senderUserSlug,
    actorUserId: payload.senderUserId,
    targetRef: { threadHandle: payload.channelUserSlug, docId: payload.docId },
    dedupeKey: `dm-received:${payload.channelUserSlug}:${payload.docId}`,
  });
}
