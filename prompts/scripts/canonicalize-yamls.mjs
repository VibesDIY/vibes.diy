#!/usr/bin/env node
// One-shot migration: rewrite every prompts/pkg/themes/colors/<slug>.yaml
// using the canonical token vocabulary (Stitch-aligned) + extras split.
//
// Mirror of the alias / canonical logic in `colorsets.ts` and
// `extract-colorsets.mjs`. Keep these three in sync — if you add a new alias
// here, add it there too.
//
// Run from prompts/: `node scripts/canonicalize-yamls.mjs`

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const colorsDir = join(here, "..", "pkg", "themes", "colors");

const CANONICAL_TOKENS = [
  "background",
  "surface",
  "primary",
  "secondary",
  "accent",
  "text-primary",
  "text-secondary",
  "text-disabled",
  "border",
  "success",
  "warning",
  "error",
  "neutral",
];
const CANONICAL_SET = new Set(CANONICAL_TOKENS);
const TOKEN_ALIASES = {
  bg: "background",
  "bg-dark": "background",
  "color-background": "background",
  "page-bg": "background",
  card: "surface",
  "card-bg": "surface",
  "card-background": "surface",
  "comp-bg": "surface",
  "bg-card": "surface",
  "bg-surface": "surface",
  "bg-panel": "surface",
  panel: "surface",
  "panel-bg": "surface",
  "comp-accent": "primary",
  "comp-secondary": "secondary",
  "comp-accent-secondary": "secondary",
  fg: "text-primary",
  text: "text-primary",
  ink: "text-primary",
  "comp-text": "text-primary",
  muted: "text-secondary",
  "fg-muted": "text-secondary",
  "fg-dim": "text-secondary",
  "comp-muted": "text-secondary",
  "text-muted": "text-secondary",
  "text-dim": "text-secondary",
  "comp-text-secondary": "text-secondary",
  outline: "border",
  stroke: "border",
  rule: "border",
  separator: "border",
  "comp-border": "border",
  "comp-success": "success",
  danger: "error",
  "comp-danger": "error",
};

function splitCanonical(raw) {
  const colors = {};
  const extras = {};
  for (const [key, value] of Object.entries(raw)) {
    if (CANONICAL_SET.has(key)) colors[key] = value;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (CANONICAL_SET.has(key)) continue;
    const alias = TOKEN_ALIASES[key];
    if (alias && CANONICAL_SET.has(alias) && !colors[alias]) {
      colors[alias] = value;
    } else {
      extras[key] = value;
    }
  }
  return { colors, extras };
}

function hasKey(raw, key) {
  return new RegExp(`^${key}:`, "m").test(raw);
}

function readMap(raw, key) {
  const out = {};
  const re = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+.*\\n?)*)`, "m");
  const block = raw.match(re);
  if (!block) return out;
  for (const line of block[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const quoted = line.match(/^[ \t]+([\w-]+):\s*"([^"]*)"/);
    if (quoted) {
      out[quoted[1]] = quoted[2];
      continue;
    }
    const unquoted = line.match(/^[ \t]+([\w-]+):\s*([^#\n]*?)\s*(?:#.*)?$/);
    if (unquoted) out[unquoted[1]] = unquoted[2].trim();
  }
  return out;
}

// Order canonical tokens by their position in CANONICAL_TOKENS so the file
// layout is stable across themes. Extras stay in source order — there's no
// canonical ordering for theme-specific names.
function orderedCanonical(colors) {
  const out = {};
  for (const token of CANONICAL_TOKENS) {
    if (colors[token] !== undefined) out[token] = colors[token];
  }
  return out;
}

function renderBlock(key, record) {
  const entries = Object.entries(record);
  if (entries.length === 0) return "";
  const lines = [`${key}:`];
  for (const [k, v] of entries) {
    lines.push(`  ${k}: "${v}"`);
  }
  return lines.join("\n") + "\n";
}

function renderYaml(cs) {
  let out = `name: ${cs.name}\n`;
  out += renderBlock("colors", orderedCanonical(cs.colors));
  if (cs.extras && Object.keys(cs.extras).length > 0) {
    out += renderBlock("extras", cs.extras);
  }
  if (cs.colorsDark) {
    out += renderBlock("colorsDark", orderedCanonical(cs.colorsDark));
  }
  if (cs.extrasDark && Object.keys(cs.extrasDark).length > 0) {
    out += renderBlock("extrasDark", cs.extrasDark);
  }
  return out;
}

async function main() {
  const files = (await readdir(colorsDir)).filter((f) => f.endsWith(".yaml"));
  let touched = 0;
  for (const file of files) {
    const path = join(colorsDir, file);
    const raw = await readFile(path, "utf8");

    const nameMatch = raw.match(/^name:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].trim() : "Untitled";
    const rawColors = readMap(raw, "colors");
    const rawExtras = hasKey(raw, "extras") ? readMap(raw, "extras") : {};
    const rawDark = hasKey(raw, "colorsDark") ? readMap(raw, "colorsDark") : undefined;
    const rawExtrasDark = hasKey(raw, "extrasDark") ? readMap(raw, "extrasDark") : {};

    const light = splitCanonical(rawColors);
    const lightExtras = { ...light.extras, ...rawExtras };

    const cs = {
      name,
      colors: light.colors,
      ...(Object.keys(lightExtras).length > 0 ? { extras: lightExtras } : {}),
    };
    if (rawDark) {
      const dark = splitCanonical(rawDark);
      const darkExtras = { ...dark.extras, ...rawExtrasDark };
      cs.colorsDark = dark.colors;
      if (Object.keys(darkExtras).length > 0) cs.extrasDark = darkExtras;
    }

    const next = renderYaml(cs);
    if (next !== raw) {
      await writeFile(path, next, "utf8");
      console.log(`canonicalized ${basename(file)}`);
      touched++;
    }
  }
  console.log(`\n${touched} of ${files.length} files rewritten.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
