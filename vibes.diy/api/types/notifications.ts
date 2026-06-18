import { type } from "arktype";

export const EvtUserNotification = type({
  type: "'vibes.diy.evt-user-notification'",
  notificationType:
    "'build-complete' | 'build-failed' | 'vibe-published' | 'comment-posted' | 'request-approved' | 'request-revoked'",
  ownerHandle: "string",
  appSlug: "string",
});
export type EvtUserNotification = typeof EvtUserNotification.infer;
export function isEvtUserNotification(obj: unknown): obj is EvtUserNotification {
  return !(EvtUserNotification(obj) instanceof type.errors);
}

// Build notifications (`build-complete` / `build-failed`) fan out to every one of
// the user's connections — including the originating tab/device — so clicking the
// browser notification can focus whichever device it was clicked on and route it to
// the vibe. Other notification types still skip the originator on fan-out.
export function isBuildNotification(notificationType: string): boolean {
  return notificationType === "build-complete" || notificationType === "build-failed";
}

// Pages without a vibe connection (My Vibes, Memberships, Messages, Settings) open a
// dedicated, lightweight notification connection pinned to a STABLE per-user shard so
// the UserNotify subscriber set stays bounded (one shard per user). Regular chat
// (codegen) connections use random-UUID shards; only shards with this prefix are
// allowed to register as user-notification subscribers, so an ephemeral codegen shard
// can never leak into the fan-out set.
export const USER_NOTIFY_SHARD_PREFIX = "notify-user-";

export function userNotifyShardFor(userId: string): string {
  return `${USER_NOTIFY_SHARD_PREFIX}${userId}`;
}

export function isUserNotifyShard(shard: string): boolean {
  return shard.startsWith(USER_NOTIFY_SHARD_PREFIX);
}

export const ReqSubscribeUserNotificationsRaw = type({
  type: "'vibes.diy.req-subscribe-user-notifications'",
});
export type ReqSubscribeUserNotificationsRaw = typeof ReqSubscribeUserNotificationsRaw.infer;
export function isReqSubscribeUserNotificationsRaw(obj: unknown): obj is ReqSubscribeUserNotificationsRaw {
  return !(ReqSubscribeUserNotificationsRaw(obj) instanceof type.errors);
}

export const ResSubscribeUserNotifications = type({
  type: "'vibes.diy.res-subscribe-user-notifications'",
  status: "'ok'",
});
export type ResSubscribeUserNotifications = typeof ResSubscribeUserNotifications.infer;
export function isResSubscribeUserNotifications(obj: unknown): obj is ResSubscribeUserNotifications {
  return !(ResSubscribeUserNotifications(obj) instanceof type.errors);
}
