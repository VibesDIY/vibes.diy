import { describe, it, expect } from "vitest";
import { IN_VIBE_SETTINGS, isInVibeSetting, MANAGE_IN_MINE } from "../app/components/vibe-editor/settings-subset.js";
describe("settings-subset (#2850)", () => {
  it("folds title/theme/icon/env into the vibe surface", () => {
    expect(IN_VIBE_SETTINGS).toEqual(["title", "theme", "icon", "env"]);
  });
  it("routes model settings to /vibes/mine", () => {
    expect(MANAGE_IN_MINE).toContain("model");
  });
  it("excludes account-level settings from the vibe surface", () => {
    expect(isInVibeSetting("title")).toBe(true);
    expect(isInVibeSetting("model")).toBe(false);
    expect(isInVibeSetting("account")).toBe(false);
  });
});
