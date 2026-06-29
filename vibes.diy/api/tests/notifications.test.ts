import { describe, expect, it } from "vitest";
import {
  isBuildNotification,
  isUserNotifyShard,
  userNotifyShardFor,
  USER_NOTIFY_SHARD_PREFIX,
  codegenShardForUser,
  shardBelongsToUser,
  MAX_ROLL_INDEX,
} from "@vibes.diy/api-types";

// `isBuildNotification` is the single source of truth for the user-notify fan-out
// rule: build notifications are delivered to every connection (including the
// originating tab/device) so a click can focus any device and route to the vibe,
// while every other type skips the originator. The DO fan-out loops in
// chat-sessions.ts / app-sessions.ts and the client click handler all branch on it,
// so guard against a notification type drifting into the wrong bucket.
describe("isBuildNotification", () => {
  it("is true for build notification types", () => {
    expect(isBuildNotification("build-complete")).toBe(true);
    expect(isBuildNotification("build-failed")).toBe(true);
  });

  it("is false for non-build notification types", () => {
    for (const t of ["vibe-published", "comment-posted", "request-approved", "request-revoked"]) {
      expect(isBuildNotification(t)).toBe(false);
    }
  });

  it("is false for unknown types", () => {
    expect(isBuildNotification("")).toBe(false);
    expect(isBuildNotification("build")).toBe(false);
  });
});

// Only stable per-user notification shards may register as UserNotify subscribers.
// ChatSessions gates registration on isUserNotifyShard so ephemeral random-UUID codegen
// shards can never leak into the fan-out set (UserNotify never prunes a shard that still
// resolves to a live DO). The client (provider) and server (chat-sessions.ts) must agree
// on the shard format, so both go through these helpers.
describe("user-notify shard", () => {
  it("builds a stable, prefixed shard for a user", () => {
    expect(userNotifyShardFor("user_123")).toBe(`${USER_NOTIFY_SHARD_PREFIX}user_123`);
    // Stable: same input → same shard (one subscriber shard per user).
    expect(userNotifyShardFor("user_123")).toBe(userNotifyShardFor("user_123"));
  });

  it("recognizes its own shards", () => {
    expect(isUserNotifyShard(userNotifyShardFor("user_123"))).toBe(true);
  });

  it("rejects non-notification shards (e.g. random-UUID codegen shards)", () => {
    expect(isUserNotifyShard("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isUserNotifyShard("alice--my-app")).toBe(false);
    expect(isUserNotifyShard("")).toBe(false);
  });
});

// The per-user codegen shard FAMILY (cold-start + admission-control auto-roll).
// `codegenShardForUser(u, n)` mints the n-th shard; `shardBelongsToUser` is the
// codegen-plane registration guard — it must admit the bounded family while
// rejecting forged / out-of-range suffixes so the per-user subscriber set stays
// capped at MAX_ROLL_INDEX + 1.
describe("codegen shard family", () => {
  const uid = "user_123";
  const base = userNotifyShardFor(uid);

  it("n=0 is the base notify shard (passes the notify guard for free)", () => {
    expect(codegenShardForUser(uid, 0)).toBe(base);
    // negative/0 both collapse to base
    expect(codegenShardForUser(uid, -1)).toBe(base);
    expect(isUserNotifyShard(codegenShardForUser(uid, 0))).toBe(true);
  });

  it("n>=1 appends a ~n suffix and stays within the notify prefix", () => {
    expect(codegenShardForUser(uid, 1)).toBe(`${base}~1`);
    expect(codegenShardForUser(uid, MAX_ROLL_INDEX)).toBe(`${base}~${MAX_ROLL_INDEX}`);
    // Rolled shards are still notify-prefixed, so the codegen registration's
    // isUserNotifyShard gate lets them through to shardBelongsToUser.
    expect(isUserNotifyShard(codegenShardForUser(uid, 3))).toBe(true);
  });

  it("shardBelongsToUser accepts the base and in-range suffixes", () => {
    expect(shardBelongsToUser(base, uid)).toBe(true);
    expect(shardBelongsToUser(`${base}~1`, uid)).toBe(true);
    expect(shardBelongsToUser(`${base}~${MAX_ROLL_INDEX}`, uid)).toBe(true);
  });

  it("rejects another user's family, forged/non-numeric suffixes, and out-of-range", () => {
    expect(shardBelongsToUser(userNotifyShardFor("user_999"), uid)).toBe(false);
    expect(shardBelongsToUser(`${base}~0`, uid)).toBe(false); // 0 is not a roll suffix (base is unsuffixed)
    expect(shardBelongsToUser(`${base}~01`, uid)).toBe(false); // leading zero
    expect(shardBelongsToUser(`${base}~${MAX_ROLL_INDEX + 1}`, uid)).toBe(false); // out of range
    expect(shardBelongsToUser(`${base}~`, uid)).toBe(false); // empty suffix
    expect(shardBelongsToUser(`${base}~1a`, uid)).toBe(false); // non-numeric
    expect(shardBelongsToUser(`${base}~1~2`, uid)).toBe(false); // nested
    expect(shardBelongsToUser(`${base}extra`, uid)).toBe(false); // no separator
  });
});
