import { emitNotification, EmitNotificationCtx } from "./emit-notification.js";

// The slice of an EvtRequestGrant `grant` the request notifier reads. A real
// ResRequestAccess (payload.grant) satisfies this. NOTE: the grant carries
// `updated` (an ISO timestamp bumped on each state change) but NOT a `tick`
// field — `tick` lives only on ResListRequestGrants.items. `updated` is the
// stable per-decision identifier that makes re-grants distinct.
export interface RequestGrantNotifyInput {
  readonly state: "pending" | "approved" | "revoked";
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly foreignUserId: string;
  readonly updated: string;
}

/**
 * Persist a `request-approved` / `request-revoked` notification for the
 * requester and fan out the live bell. No-op for the `pending` state.
 *
 * Recipient is the requester (`foreignUserId`). `dedupeKey` carries the grant's
 * `updated` timestamp so each distinct decision (re-grant after a revoke, etc.)
 * notifies once while event re-delivery does not double-notify.
 */
export async function notifyRequestGrant(qctx: EmitNotificationCtx, grant: RequestGrantNotifyInput): Promise<void> {
  if (grant.state !== "approved" && grant.state !== "revoked") return;

  const notificationType = grant.state === "approved" ? "request-approved" : "request-revoked";
  const body =
    grant.state === "approved"
      ? `Access to ${grant.ownerHandle}/${grant.appSlug} approved.`
      : `Access to ${grant.ownerHandle}/${grant.appSlug} was revoked.`;

  await emitNotification(qctx, {
    userId: grant.foreignUserId,
    notificationType,
    ownerHandle: grant.ownerHandle,
    appSlug: grant.appSlug,
    body,
    dedupeKey: `${notificationType}:${grant.ownerHandle}:${grant.appSlug}:${grant.foreignUserId}:${grant.updated}`,
  });
}
