import { describe, it, expect } from "vitest";
import { isReqVibeWhoAmI, isResVibeWhoAmI, isEvtVibeViewerChanged } from "@vibes.diy/vibe-types";

describe("ReqVibeWhoAmI", () => {
  it("validates a request", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", appSlug: "myapp", userSlug: "alice" })).toBe(true);
  });
  it("rejects wrong type", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.other", tid: "abc", appSlug: "x", userSlug: "y" })).toBe(false);
  });
  it("rejects missing appSlug", () => {
    expect(isReqVibeWhoAmI({ type: "vibe.req.whoAmI", tid: "abc", userSlug: "alice" })).toBe(false);
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
        viewer: { userSlug: "alice", displayName: "Alice" },
        access: "owner",
        dbAcls: { comments: { write: ["members"] } },
      })
    ).toBe(true);
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
        viewer: { userSlug: "alice" },
        access: "viewer",
      })
    ).toBe(true);
  });
});
