#!/usr/bin/env node
// Rebuild prompts/pkg/themes/colors/<slug>.yaml from the rendered exemplars,
// recovering the post-#2199 regression (#2356): the canonicalize-on-write
// migration only RENAMED tokens, leaving 42/44 themes with a sparse canonical
// set (core colors stranded in `extras`, which the LLM-facing :root strips).
//
// Ground truth = prompts/pkg/themes/exemplars/<slug>/App.jsx. Per Charlie's
// review (#2358): the exemplars predate the colorset split and are NOT
// generated from the current yaml, so they hold each theme's real palette
// expressed in the standard role vocabulary (--bg/--card-bg/--accent/--text/
// --muted/--border/--raised/--accent-text), which maps straight onto the
// canonical names via splitCanonical().
//
// Strategy per slug:
//   colors      = { ...oldCanonical, ...exemplarLightCanonical }   (exemplar wins)
//   colorsDark  = { ...oldDark,      ...exemplarDarkCanonical }
//   extras      = { ...oldExtras,    ...exemplarLightExtras }       (kept for prose
//                  {{token}} substitution + the live runtime modal; stripped from
//                  the LLM :root anyway, so harmless to the swap contract)
//   structural  = font-family from the catalog bodyFont (real stacks only),
//                 font-family-mono detected, radius/spacing/border-width from the
//                 theme .md frontmatter where authored.
//
// Deterministic + re-runnable; its 44-file diff is the reviewable artifact.
// Run from the prompts/ dir: `node scripts/rebuild-colorsets-from-exemplars.mjs [--dry-run]`

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseColorsetYaml, splitCanonical } from "../pkg/themes/colorsets.ts";
import { vibesThemes } from "../pkg/themes/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const themesDir = join(here, "..", "pkg", "themes");
const colorsDir = join(themesDir, "colors");
const exemplarsDir = join(themesDir, "exemplars");
const DRY = process.argv.includes("--dry-run");

const DEFAULT_SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const DEFAULT_MONO = "ui-monospace, 'JetBrains Mono', Menlo, monospace";
const MONO_HINT = /mono|VT323|Menlo|Consolas|Courier/i;

// Pull `--name: value;` pairs out of a CSS declaration body.
function parseDecls(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[m[1].trim()] = m[2].trim();
  }
  return out;
}

// Light :root is the first `:root { … }`; dark is the `:root` inside the
// prefers-color-scheme: dark @media block.
function parseExemplar(src) {
  const dark = src.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/i);
  // Remove the dark block before grabbing the light :root so we don't match it.
  const lightSrc = dark ? src.slice(0, dark.index) : src;
  const light = lightSrc.match(/:root\s*\{([\s\S]*?)\}/i);
  return {
    light: light ? parseDecls(light[1]) : {},
    dark: dark ? parseDecls(dark[1]) : undefined,
  };
}

// Frontmatter helpers (no YAML dep — fixed shape).
function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : "";
}
function firstFontFamily(fm) {
  const m = fm.match(/fontFamily:\s*(.+)/);
  return m ? m[1].trim() : undefined;
}
function roundedBlock(fm) {
  // rounded:\n  sm: 4px\n  DEFAULT: 4px\n  lg: 4px
  const block = fm.match(/^rounded:\s*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return {};
  const r = {};
  for (const line of block[1].split("\n")) {
    const lm = line.match(/^\s+([\w-]+):\s*(.+)$/);
    if (lm) r[lm[1].toLowerCase()] = lm[2].trim();
  }
  return r;
}
function spacingUnit(fm) {
  const block = fm.match(/^spacing:\s*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return undefined;
  const m = block[1].match(/^\s+(?:unit|md):\s*(.+)$/m);
  return m ? m[1].trim() : undefined;
}

function resolveFonts(slug, fm) {
  const catalog = vibesThemes.find((t) => t.slug === slug);
  let font = catalog?.bodyFont;
  // Catalog placeholders like var(--font-sans) aren't usable font-family values.
  if (!font || font.includes("var(")) {
    const mdFont = firstFontFamily(fm);
    font = mdFont && !mdFont.includes("var(") ? mdFont : DEFAULT_SANS;
  }
  const mono = MONO_HINT.test(font) ? font : DEFAULT_MONO;
  return { font, mono };
}

function buildStructural(slug, fm) {
  const { font, mono } = resolveFonts(slug, fm);
  const rounded = roundedBlock(fm);
  const sp = spacingUnit(fm);
  const out = { "font-family": font, "font-family-mono": mono };
  if (rounded.default || rounded.md) out.radius = rounded.default ?? rounded.md;
  if (rounded.sm) out["radius-sm"] = rounded.sm;
  if (rounded.lg) out["radius-lg"] = rounded.lg;
  if (sp) out.spacing = sp;
  return out;
}

function renderBlock(key, map) {
  if (!map || Object.keys(map).length === 0) return "";
  return [`${key}:`, ...Object.entries(map).map(([k, v]) => `  ${k}: "${v}"`)].join("\n") + "\n";
}

function merge(a, b) {
  return { ...(a ?? {}), ...(b ?? {}) };
}

const slugs = (await readdir(exemplarsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let changed = 0;
for (const slug of slugs) {
  const exemplarSrc = await readFile(join(exemplarsDir, slug, "App.jsx"), "utf8").catch(() => undefined);
  if (!exemplarSrc) {
    console.warn(`! ${slug}: no exemplar App.jsx — skipped`);
    continue;
  }
  const oldRaw = await readFile(join(colorsDir, `${slug}.yaml`), "utf8").catch(() => "");
  const old = oldRaw ? parseColorsetYaml(oldRaw) : { name: slug, colors: {} };
  const md = await readFile(join(themesDir, `${slug}.md`), "utf8").catch(() => "");
  const fm = frontmatter(md);

  const ex = parseExemplar(exemplarSrc);
  const exLight = splitCanonical(ex.light);
  const exDark = ex.dark ? splitCanonical(ex.dark) : undefined;

  const colors = merge(old.colors, exLight.colors);
  const extras = merge(old.extras, exLight.extras);
  // Seed accent/background from the catalog when the exemplar's were bespoke
  // (e.g. chrome's accent is `--neon-red`, stranded in extras). The catalog
  // accentColor/bgColor are the theme's authoritative interactive/canvas hues.
  const catalog = vibesThemes.find((t) => t.slug === slug);
  if (!colors.accent && !colors.primary && catalog?.accentColor && !catalog.accentColor.includes("var(")) {
    colors.accent = catalog.accentColor;
  }
  if (!colors.background && catalog?.bgColor && !catalog.bgColor.includes("var(")) {
    colors.background = catalog.bgColor;
  }
  const colorsDark = exDark ? merge(old.colorsDark, exDark.colors) : old.colorsDark;
  const extrasDark = exDark ? merge(old.extrasDark, exDark.extras) : old.extrasDark;
  const structural = buildStructural(slug, fm);

  const yaml =
    `name: ${old.name || slug}\n` +
    renderBlock("colors", colors) +
    renderBlock("colorsDark", colorsDark) +
    renderBlock("extras", extras) +
    renderBlock("extrasDark", extrasDark) +
    renderBlock("structural", structural);

  const core = ["background", "surface", "primary", "accent", "border", "text-primary", "text-secondary", "secondary"];
  const haveOrDerivable = core.filter((c) => colors[c] || c === "secondary" || c === "primary");
  const missing = core.filter((c) => !haveOrDerivable.includes(c));
  console.log(
    `${slug.padEnd(22)} colors=${Object.keys(colors).length} dark=${colorsDark ? "y" : "n"} ` +
      `extras=${Object.keys(extras).length} font=${structural["font-family"].split(",")[0]}` +
      (missing.length ? `  MISSING(derived@compose): ${missing.join(",")}` : "")
  );

  if (!DRY) {
    await writeFile(join(colorsDir, `${slug}.yaml`), yaml, "utf8");
    changed++;
  }
}
console.log(`\n${DRY ? "(dry-run) " : ""}${DRY ? slugs.length + " inspected" : changed + " yaml files written"}`);
