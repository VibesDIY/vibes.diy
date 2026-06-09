import { describe, it, expect } from "vitest";
import { isReqVibeWhoAmI, isResVibeWhoAmI, isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";

describe("ReqVibeWhoAmI", () => {
  it("validates a request", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", appSlug: "myapp", ownerHandle: "alice" })).toBe(true);
  });
  it("rejects wrong type", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.other", tid: "abc", appSlug: "x", ownerHandle: "y" })).toBe(false);
  });
  it("rejects missing appSlug", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", ownerHandle: "alice" })).toBe(false);
  });
});

describe("ResVibeWhoAmI", () => {
  it("validates anon response (viewer null)", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: null,
        access: "none",
      })
    ).toBe(true);
  });
  it("validates signed-in response with dbAcls", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: { userHandle: "alice", displayName: "Alice" },
        access: "override",
        dbAcls: { comments: { write: ["members"] } },
      })
    ).toBe(true);
  });
  it("validates signed-in response with grants", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: { userHandle: "alice", displayName: "Alice" },
        access: "override",
        grants: { comments: { channels: ["general"], publicChannels: ["announcements"], roles: ["moderator"] } },
      })
    ).toBe(true);
  });
  it("rejects viewer missing userHandle", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: { ownerHandle: "alice" },
        access: "override",
      })
    ).toBe(false);
  });
  it("rejects bad access value", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "abc",
        viewer: null,
        access: "superadmin",
      })
    ).toBe(false);
  });
});

describe("EvtVibeViewerChanged", () => {
  it("validates an event (no tid)", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "alice" },
        access: "viewer",
      })
    ).toBe(true);
  });
  it("rejects bad access value", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "alice" },
        access: "superadmin",
      })
    ).toBe(false);
  });
  it("rejects viewer missing userHandle", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { ownerHandle: "alice" },
        access: "viewer",
      })
    ).toBe(false);
  });
  it("validates anon viewer (null)", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: null,
        access: "none",
      })
    ).toBe(true);
  });
});
