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

// --- Per-user codegen shard family (cold-start + admission-control auto-roll).
//
// The website pins each authenticated user's heavy codegen chat to a stable
// per-user DO (base shard = userNotifyShardFor(userId)) so the 2nd+ chat rejoins
// a warm DO instead of cold-starting a random-UUID one. To re-earn the CPU
// isolation that random sharding gave, the codegen DO admits a bounded number of
// concurrent streams and returns `shard-overloaded` past it; the client then
// rolls to the next shard in THIS family and retries.

// Max codegen-shard roll index. The client rolls 0..MAX_ROLL_INDEX on
// `shard-overloaded`; the codegen-plane registration guard accepts the SAME
// bounded family, so the per-user UserNotify subscriber set stays capped at
// MAX_ROLL_INDEX + 1 (not unbounded). Client roll-bound and server guard MUST
// read this one constant or the client could roll to a shard the guard rejects.
export const MAX_ROLL_INDEX = 8;

// The codegen shard string for `userId` at roll index `n`. n=0 is the base shard
// — byte-identical to userNotifyShardFor(userId), so it passes the notify-shard
// guard for free; n>=1 appends `~n`.
export function codegenShardForUser(userId: string, n: number): string {
  const base = userNotifyShardFor(userId);
  return n <= 0 ? base : `${base}~${n}`;
}

// Whether `shard` belongs to `userId`'s codegen shard family: the base notify
// shard, OR `${base}~${n}` with `n` a STRICT integer in 1..MAX_ROLL_INDEX
// (digits only, no leading zero, in range). Strict parsing + the hard upper
// bound keep the accepted set finite — this is what preserves Track B's
// bounded-subscriber-set property on the codegen plane.
//
// ⚠️ Codegen plane ONLY. The shared plane must keep STRICT equality
// (`shard === userNotifyShardFor(userId)`) so its subscriber set stays exactly
// one per user; only the codegen plane rolls, so only it relaxes to the family.
export function shardBelongsToUser(shard: string, userId: string): boolean {
  const base = userNotifyShardFor(userId);
  if (shard === base) return true;
  if (!shard.startsWith(`${base}~`)) return false;
  const suffix = shard.slice(base.length + 1);
  if (!/^[1-9][0-9]*$/.test(suffix)) return false; // strict: no leading zero, digits only
  const n = Number(suffix);
  return n >= 1 && n <= MAX_ROLL_INDEX;
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
