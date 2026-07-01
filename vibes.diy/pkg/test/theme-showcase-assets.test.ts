import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { vibesThemes } from "@vibes.diy/prompts";

// Regression guard for VibesDIY/vibes.diy#2924: every catalog theme must ship a
// `/themes/<slug>.html` showcase asset. When one is missing, the route serves
// the SPA "Page Not Found" page and every surface that scales it into a preview
// (ThemePickerModal, the in-vibe settings theme thumbnail) renders a broken 404
// card instead of the theme preview. `brutalist` was the theme that slipped
// through — this test keeps the catalog and the showcase assets in lockstep.

function showcasePath(slug: string): string {
  return fileURLToPath(new URL(`../public/themes/${slug}.html`, import.meta.url));
}

describe("theme showcase assets (#2924)", () => {
  it.each(vibesThemes.map((t) => t.slug))("%s has a /themes/<slug>.html showcase", (slug) => {
    expect(existsSync(showcasePath(slug)), `missing public/themes/${slug}.html showcase asset`).toBe(true);
  });
});
