import { describe, expect, it } from "vitest";
import { sectionThemeActions } from "../../pkg/app/hooks/section-theme-actions.js";

describe("sectionThemeActions", () => {
  const base = { type: "prompt.section-theme" as const, streamId: "s", chatId: "c", seq: 0, timestamp: new Date() };

  it("resolves a known slug to a setTheme action carrying the catalog theme", () => {
    const actions = sectionThemeActions({ ...base, theme: "aether" });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("setTheme");
    expect((actions[0] as { theme: { slug: string } }).theme.slug).toBe("aether");
  });

  it("adds a setColorTheme action when colorTheme is present", () => {
    const actions = sectionThemeActions({ ...base, theme: "aether", colorTheme: "acid-pop" });
    expect(actions.map((a) => a.type)).toEqual(["setTheme", "setColorTheme"]);
  });

  it("returns no actions for an unknown slug", () => {
    expect(sectionThemeActions({ ...base, theme: "definitely-not-a-real-slug" })).toHaveLength(0);
  });
});
