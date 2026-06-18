import { describe, expect, it } from "vitest";
import { isBuildNotification, isUserNotifyShard, userNotifyShardFor, USER_NOTIFY_SHARD_PREFIX } from "@vibes.diy/api-types";

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
