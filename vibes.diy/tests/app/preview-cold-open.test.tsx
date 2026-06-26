import { describe, expect, it } from "vitest";
import { shouldShowColdOpen, coldOpenSlugFrom } from "../../pkg/app/components/ResultPreview/PreviewApp.js";
import type { VibesTheme } from "@vibes.diy/prompts";

// shouldShowColdOpen is a pure function of three state values.
// Extracted from PreviewApp so it can be unit-tested without mounting
// the full component (which requires useParams, useVibesDiy, etc.).
describe("PreviewApp cold open", () => {
  it("shows the themed skeleton while generating with nothing painted yet", () => {
    const result = shouldShowColdOpen({ running: true, pinnedFsId: undefined, firstStreamDone: false });
    expect(result).toBe(true);
  });

  it("hides the themed skeleton once the app has painted", () => {
    const result = shouldShowColdOpen({ running: false, pinnedFsId: "fs-123", firstStreamDone: true });
    expect(result).toBe(false);
  });
});

// coldOpenSlugFrom selects the colorset slug for the cold-open palette.
// Pre-allocation writes only `active.theme` (hydrated into promptState.theme,
// a VibesTheme), never `active.colorTheme` — so on a fresh generation the slug
// must fall back to the theme's slug. prompt-state.ts documents "colorTheme
// Defaults to the same slug as theme"; this implements that default.
const aetherTheme: VibesTheme = {
  slug: "aether",
  name: "Aether Brass",
  accentColor: "#cfa562",
  bgColor: "#dcbfa6",
};

describe("coldOpenSlugFrom", () => {
  it("uses explicit colorTheme when it is a non-empty string", () => {
    expect(coldOpenSlugFrom({ colorTheme: "matrix", theme: aetherTheme })).toBe("matrix");
  });

  it("falls back to the theme slug when colorTheme is unset", () => {
    expect(coldOpenSlugFrom({ theme: aetherTheme })).toBe("aether");
  });

  it("falls back to the theme slug when colorTheme is null or empty", () => {
    expect(coldOpenSlugFrom({ colorTheme: null, theme: aetherTheme })).toBe("aether");
    expect(coldOpenSlugFrom({ colorTheme: "", theme: aetherTheme })).toBe("aether");
  });

  it("returns undefined when both colorTheme and theme are absent", () => {
    expect(coldOpenSlugFrom({})).toBeUndefined();
    expect(coldOpenSlugFrom({ colorTheme: null, theme: null })).toBeUndefined();
  });
});
