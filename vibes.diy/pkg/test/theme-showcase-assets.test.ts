import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { vibesThemes } from "@vibes.diy/prompts";

// Regression guard for VibesDIY/vibes.diy#2924: every catalog theme must ship a
// `/themes/<slug>.html` showcase asset. When one is missing, the route serves
// the SPA "Page Not Found" page and every surface that scales it into a preview
// (ThemePickerModal, the in-vibe settings theme thumbnail) renders a broken 404
// card instead of the theme preview. `brutalist` was the theme that slipped
// through — this test keeps the catalog and the showcase assets in lockstep.

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = resolve(__dirname, "..", "public", "themes");

describe("theme showcase assets (#2924)", () => {
  it.each(vibesThemes.map((t) => t.slug))("%s has a /themes/<slug>.html showcase", (slug) => {
    const showcase = resolve(THEMES_DIR, `${slug}.html`);
    expect(existsSync(showcase), `missing public/themes/${slug}.html showcase asset`).toBe(true);
  });
});
