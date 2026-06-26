import { describe, expect, it } from "vitest";
import { colorsetToSkeletonTokens } from "../../pkg/app/components/ResultPreview/ThemedSkeleton.js";
import type { Colorset } from "@vibes.diy/prompts";

// A representative colorset matching the bundle's real shape (see
// prompts/pkg/themes/colorsets-bundle.ts — "aether"). The mapper pulls the
// canonical LIGHT colors + structural block into the ColorThemeTokens shape.
const aether: Colorset = {
  name: "Aether Brass",
  colors: {
    "text-primary": "rgba(20, 20, 20, 0.92)",
    accent: "#cfa562",
    border: "rgba(20, 20, 20, 0.14)",
    background: "#dcbfa6",
    "text-secondary": "rgba(20, 20, 20, 0.5)",
    surface: "rgba(255, 255, 255, 0.85)",
  },
  colorsDark: {
    accent: "#9d7330",
    background: "#593c23",
  },
  structural: { "font-family": "'Special Elite', monospace", "font-family-mono": "'Special Elite', monospace" },
};

describe("colorsetToSkeletonTokens", () => {
  it("maps the canonical LIGHT colors into the ColorThemeTokens shape", () => {
    const tokens = colorsetToSkeletonTokens(aether);
    expect(tokens.background).toBe("#dcbfa6");
    expect(tokens.surface).toBe("rgba(255, 255, 255, 0.85)");
    expect(tokens.accent).toBe("#cfa562");
    expect(tokens["text-primary"]).toBe("rgba(20, 20, 20, 0.92)");
    expect(tokens.border).toBe("rgba(20, 20, 20, 0.14)");
  });

  it("uses LIGHT colors, not the dark variant", () => {
    const tokens = colorsetToSkeletonTokens(aether);
    expect(tokens.accent).toBe("#cfa562"); // light, not "#9d7330"
    expect(tokens.background).toBe("#dcbfa6"); // light, not "#593c23"
  });

  it("pulls font-family from the structural block", () => {
    const tokens = colorsetToSkeletonTokens(aether);
    expect(tokens["font-family"]).toBe("'Special Elite', monospace");
  });

  it("maps primary from the colors map when present", () => {
    const withPrimary: Colorset = {
      name: "Atelier",
      colors: { background: "#fff", primary: "oklch(0.65 0.18 55)", accent: "oklch(0.65 0.18 55)" },
    };
    const tokens = colorsetToSkeletonTokens(withPrimary);
    expect(tokens.primary).toBe("oklch(0.65 0.18 55)");
  });

  it("omits structural tokens that are absent (ThemedSkeleton has neutral fallbacks)", () => {
    const noStructural: Colorset = { name: "Bare", colors: { background: "#000", accent: "#fff" } };
    const tokens = colorsetToSkeletonTokens(noStructural);
    expect(tokens["font-family"]).toBeUndefined();
    expect(tokens.radius).toBeUndefined();
  });

  it("pulls radius from structural when present", () => {
    const withRadius: Colorset = {
      name: "Neobrutalist",
      colors: { background: "#f5f0e0", accent: "#DA291C" },
      structural: { "font-family": "'Space Grotesk', sans-serif", radius: "4px" },
    };
    const tokens = colorsetToSkeletonTokens(withRadius);
    expect(tokens.radius).toBe("4px");
  });
});
