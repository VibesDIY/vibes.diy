import { describe, it, expect } from "vitest";
import { forkDestination } from "~/vibes.diy/app/routes/vibe-fork.js";

const res = { ownerHandle: "alex", appSlug: "bloom", srcFsId: "FS-9" };

describe("forkDestination", () => {
  it("builds the forked /vibe URL with prompt64 + yours=1", () => {
    const url = forkDestination(res, "bWFrZSBpdCBibHVl");
    expect(url).toContain("/vibe/alex/bloom/FS-9");
    expect(url).toContain("prompt64=bWFrZSBpdCBibHVl");
    expect(url).toContain("yours=1");
  });

  it("omits prompt64 when none is carried", () => {
    const url = forkDestination(res, null);
    expect(url).toBe("/vibe/alex/bloom/FS-9?yours=1");
  });
});
