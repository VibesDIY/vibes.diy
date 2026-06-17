import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composeDesignMd, parseColorsetYaml, vibesThemes } from "@vibes.diy/prompts";

// Catalog-wide guardrail for the #2356 regression: compose EVERY theme's
// design.md and assert the LLM-facing :root is complete, theme-accurate, and
// syntactically usable. This converts the four observed defects into permanent
// regression guards:
//   1. starved :root (42/44 themes missing core colors)
//   2. generic structural defaults for every theme
//   3. invalid-JS classNames example
//   4. unresolved {{token}} placeholders
//
// Runs against the on-disk theme markdown + colorset yaml (the real assets the
// API composes), not fixtures.

const CORE_COLORS = [
  "background",
  "surface",
  "primary",
  "secondary",
  "accent",
  "text-primary",
  "text-secondary",
  "border",
] as const;

const STRUCTURAL = [
  "font-family",
  "font-family-mono",
  "font-size-base",
  "radius",
  "radius-sm",
  "radius-lg",
  "spacing",
  "border-width",
] as const;

const GENERIC_FONT = "system-ui";

function readAsset(rel: string): string {
  return readFileSync(new URL(`../pkg/themes/${rel}`, import.meta.url), "utf8");
}

function composeTheme(slug: string): string {
  const md = readAsset(`${slug}.md`);
  const yaml = readAsset(`colors/${slug}.yaml`);
  return composeDesignMd(md, parseColorsetYaml(yaml));
}

// The discipline block emits the operative :root inside its ```html <style> …
// </style>``` fence. Scope to that fence — some theme prose (chrome, default)
// contains its own illustrative `:root {…}` snippets we must not pick up.
function lightRootVars(composed: string): Record<string, string> {
  const style = composed.match(/```html\n<style>\n([\s\S]*?)<\/style>/);
  const scope = style ? style[1] : composed;
  const root = scope.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) return {};
  const out: Record<string, string> = {};
  for (const m of root[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1].trim()] = m[2].trim();
  }
  return out;
}

// Accept the color forms our palettes actually use, plus the var()-based
// color-mix the composer derives. A non-empty check alone is insufficient —
// a malformed color-mix(... bare-identifier ...) would pass it while breaking
// `text-[var(--text-secondary)]` at runtime (Codex review on #2358).
function isCssColor(v: string): boolean {
  return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color-mix\(|var\()/i.test(v.trim());
}

// Pull the classNames example so we can prove it parses. The discipline block
// appends it last, so take the final ```js fence (theme prose may contain its
// own earlier js snippets).
function classNamesExampleJs(composed: string): string {
  const all = [...composed.matchAll(/```js\n([\s\S]*?)\n```/g)];
  return all.length ? all[all.length - 1][1] : "";
}

describe("theme completeness (catalog-wide guardrail #2356)", () => {
  it.each(vibesThemes.map((t) => t.slug))("%s composes a complete, valid :root", (slug) => {
    const composed = composeTheme(slug);
    const root = lightRootVars(composed);

    // 1. every core color present + a valid CSS color (not just non-empty)
    for (const token of CORE_COLORS) {
      expect(root[token], `${slug}: missing --${token} in :root`).toBeTruthy();
      expect(isCssColor(root[token]), `${slug}: --${token} = "${root[token]}" is not a valid CSS color`).toBe(true);
    }

    // 2. every structural slot present
    for (const token of STRUCTURAL) {
      expect(root[token], `${slug}: missing structural --${token}`).toBeTruthy();
    }

    // 3. the classNames example must parse as JS (hyphenated keys must be quoted)
    const js = classNamesExampleJs(composed);
    expect(js.length, `${slug}: no classNames example emitted`).toBeGreaterThan(0);
    expect(() => new Function(js), `${slug}: classNames example is not valid JS`).not.toThrow();

    // 4. no unresolved {{token}} placeholders leaked into the prompt
    expect(composed, `${slug}: unresolved {{token}} in composed design.md`).not.toMatch(/\{\{[a-z0-9-]+\}\}/);
  });

  it("themes are not all collapsed onto the generic system-ui font", () => {
    // The #2356 regression made EVERY theme render system-ui because no
    // colorset defined structural tokens. After the rebuild, font-family is
    // theme-specific for the large majority (only the handful of themes whose
    // catalog bodyFont is a var() placeholder fall back to system-ui).
    const fonts = vibesThemes.map((t) => lightRootVars(composeTheme(t.slug))["font-family"] ?? "");
    const nonGeneric = fonts.filter((f) => !f.includes(GENERIC_FONT));
    expect(nonGeneric.length).toBeGreaterThan(vibesThemes.length / 2);
    // And there must be real variety, not one font for everyone.
    expect(new Set(fonts).size).toBeGreaterThan(5);
  });
});
