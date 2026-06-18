import { describe, expect, it } from "vitest";
import { isBuildNotification } from "@vibes.diy/api-types";

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
