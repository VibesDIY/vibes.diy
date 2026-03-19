import { describe, it, expect } from "vitest";
import { loadThemeCSS } from "./index.js";

describe("loadThemeCSS", () => {
  it("returns CSS with design tokens", async () => {
    const result = await loadThemeCSS();
    expect(result.isOk()).toBe(true);
    const css = result.Ok();
    expect(css).toContain("--vibes-blue:");
    expect(css).toContain("--vibes-card-bg:");
    expect(css).toContain("--vibes-button-bg:");
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("returns the same cached result on subsequent calls", async () => {
    const result1 = loadThemeCSS();
    const result2 = loadThemeCSS();
    expect(result1).toBe(result2);
  });
});
