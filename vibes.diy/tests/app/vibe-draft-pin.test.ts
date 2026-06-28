import { describe, it, expect } from "vitest";
import { pinnedIframeFsId } from "~/vibes.diy/app/routes/vibe-draft-pin.js";

// #2772 D1 — the "versioned URL no-repin" guardrail (spec §3b / §7).
describe("pinnedIframeFsId", () => {
  it("NEVER overrides an explicit versioned URL with the owner's draft", () => {
    // A route-param fsId is an explicit request → byte-for-byte unchanged for the owner.
    expect(pinnedIframeFsId("v123", "draft999")).toBe("v123");
  });

  it("pins the owner's draft fsId on an unversioned URL", () => {
    expect(pinnedIframeFsId(undefined, "draft999")).toBe("draft999");
  });

  it("stays unversioned (production) when neither is set", () => {
    expect(pinnedIframeFsId(undefined, undefined)).toBeUndefined();
  });
});
