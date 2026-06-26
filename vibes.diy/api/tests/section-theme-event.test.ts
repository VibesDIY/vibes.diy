import { describe, expect, it } from "vitest";
import { buildSectionThemeEvent } from "../svc/intern/codegen-loop/section-theme-event.js";

describe("buildSectionThemeEvent", () => {
  const base = { streamId: "s1", chatId: "c1", seq: 3, timestamp: new Date(0) };

  it("builds a theme-only event", () => {
    const evt = buildSectionThemeEvent({ theme: "aether", ...base });
    expect(evt).toEqual({
      type: "prompt.section-theme",
      theme: "aether",
      streamId: "s1",
      chatId: "c1",
      seq: 3,
      timestamp: new Date(0),
    });
  });

  it("includes colorTheme only when a non-empty slug is given", () => {
    expect(buildSectionThemeEvent({ theme: "aether", colorTheme: "acid-pop", ...base }).colorTheme).toBe("acid-pop");
    expect("colorTheme" in buildSectionThemeEvent({ theme: "aether", colorTheme: "", ...base })).toBe(false);
  });
});
