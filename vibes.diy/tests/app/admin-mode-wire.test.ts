import { describe, it, expect } from "vitest";
import { isEvtVibeViewerChanged, isResVibeWhoAmI } from "@vibes.diy/vibe-types";

describe("adminMode on identity wire types", () => {
  it("EvtVibeViewerChanged accepts adminMode", () => {
    expect(
      isEvtVibeViewerChanged({
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "alice" },
        access: "viewer",
        adminMode: true,
      })
    ).toBe(true);
  });

  it("ResVibeWhoAmI accepts adminMode", () => {
    expect(
      isResVibeWhoAmI({
        type: "vibe.res.whoAmI",
        tid: "t1",
        viewer: { userHandle: "alice" },
        access: "viewer",
        adminMode: true,
      })
    ).toBe(true);
  });

  it("both still accept payloads without adminMode (optional)", () => {
    expect(isEvtVibeViewerChanged({ type: "vibe.evt.viewerChanged", viewer: null, access: "none" })).toBe(true);
  });

  // Guards that adminMode is a DECLARED boolean field, not just an undeclared
  // key arktype ignores: a non-boolean value must be rejected. Without the
  // `"adminMode?": "boolean"` declaration this payload would validate (the key
  // would be an ignored extra), so this case is what actually fails if the
  // type addition is reverted.
  it("rejects a non-boolean adminMode", () => {
    expect(
      isEvtVibeViewerChanged({ type: "vibe.evt.viewerChanged", viewer: null, access: "none", adminMode: "yes" })
    ).toBe(false);
    expect(
      isResVibeWhoAmI({ type: "vibe.res.whoAmI", tid: "t1", viewer: null, access: "none", adminMode: 1 })
    ).toBe(false);
  });
});
