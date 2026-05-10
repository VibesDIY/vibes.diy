import { describe, it, expect } from "vitest";
import { isUserSettingProfile, userSettingItem } from "@vibes.diy/api-types";

describe("userSettingProfile", () => {
  it("accepts both fields optional", () => {
    expect(isUserSettingProfile({ type: "profile" })).toBe(true);
  });

  it("accepts avatarCid + displayName", () => {
    expect(isUserSettingProfile({ type: "profile", avatarCid: "bafy123", displayName: "Alice" })).toBe(true);
  });

  it("rejects wrong discriminant", () => {
    expect(isUserSettingProfile({ type: "sharing", grants: [] })).toBe(false);
  });

  it("is a member of userSettingItem union", () => {
    const result = userSettingItem({ type: "profile", avatarCid: "bafy123" });
    expect(result instanceof Error).toBe(false);
  });
});
