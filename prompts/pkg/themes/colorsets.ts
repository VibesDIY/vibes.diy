// Theme colorsets. The structural theme markdown lives in `<slug>.md`; the
// colors (light + dark token values) live separately in `colors/<slug>.yaml`.
// Composing them at codegen time lets a single structural theme combine with
// any colorset without LLM contradictions — see ticket #1853.
//
// Token vocabulary is now standardized on a Stitch-aligned canonical set so
// that any palette can be applied to any theme without breaking references.
// Legacy yamls (and the comp-* dialect) keep working: parseColorsetYaml maps
// known aliases (`bg` → `background`, `comp-bg` → `surface`, `fg` →
// `text-primary`, …) onto canonical names at parse time. Tokens that don't
// match a canonical role flow into `extras` per-theme — the theme can still
// reference them via `{{token}}` in prose, but they never cross palettes.

// The 13 canonical tokens. Same names as Google Stitch's design.md so a
// Stitch-authored file is a drop-in import. Themes are guaranteed to expose
// these slots after parsing (missing ones are filled by deriveCanonical()).
export const CANONICAL_TOKENS = [
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
] as const;

export type CanonicalToken = (typeof CANONICAL_TOKENS)[number];

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_TOKENS);

// Mode-agnostic structural tokens — typography, spacing, radius, border. Same
// in light and dark by convention (font-family doesn't flip on dark mode).
// The platform's runtime applies these alongside colors so a viewmaster swap
// can restyle typography + layout instantly without a codegen turn.
export const CANONICAL_STRUCTURAL = [
  "font-family",
  "font-family-mono",
  "font-size-base",
  "radius",
  "radius-sm",
  "radius-lg",
  "spacing",
  "border-width",
] as const;

export type CanonicalStructuralToken = (typeof CANONICAL_STRUCTURAL)[number];

const STRUCTURAL_SET: ReadonlySet<string> = new Set(CANONICAL_STRUCTURAL);

// Hardcoded fallbacks so every theme advertises the same 8 structural slots
// even when the yaml omits them. Picked to look reasonable on the typical
// vibes app shape (Tailwind-ish defaults).
const STRUCTURAL_DEFAULTS: Readonly<Record<string, string>> = {
  "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  "font-family-mono": "ui-monospace, 'JetBrains Mono', Menlo, monospace",
  "font-size-base": "1rem",
  radius: "0.5rem",
  "radius-sm": "0.25rem",
  "radius-lg": "1rem",
  spacing: "1rem",
  "border-width": "1px",
};

export function deriveStructural(structural?: Record<string, string>): Record<string, string> {
  const out = { ...(structural ?? {}) };
  for (const [k, v] of Object.entries(STRUCTURAL_DEFAULTS)) {
    if (!out[k]) out[k] = v;
  }
  return out;
}

// Maps legacy token names from older themes (and the comp-* dialect) onto the
// canonical vocabulary. Only unambiguous renames live here. Role-specific
// tokens like `accent-text` (= "on-accent", a Stitch-absent concept) are NOT
// aliased so they remain in `extras` for the theme that defined them.
export const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  // background
  bg: "background",
  "bg-dark": "background",
  "color-background": "background",
  "page-bg": "background",

  // surface
  card: "surface",
  "card-bg": "surface",
  "card-background": "surface",
  "comp-bg": "surface",
  "bg-card": "surface",
  "bg-surface": "surface",
  "bg-panel": "surface",
  panel: "surface",
  "panel-bg": "surface",

  // primary (the comp-* dialect's main interactive color)
  "comp-accent": "primary",

  // secondary
  "comp-secondary": "secondary",
  "comp-accent-secondary": "secondary",

  // text-primary
  fg: "text-primary",
  text: "text-primary",
  ink: "text-primary",
  "comp-text": "text-primary",

  // text-secondary
  muted: "text-secondary",
  "fg-muted": "text-secondary",
  "fg-dim": "text-secondary",
  "comp-muted": "text-secondary",
  "text-muted": "text-secondary",
  "text-dim": "text-secondary",
  "comp-text-secondary": "text-secondary",

  // border
  outline: "border",
  stroke: "border",
  rule: "border",
  separator: "border",
  "comp-border": "border",

  // semantic states
  "comp-success": "success",
  danger: "error",
  "comp-danger": "error",
};

export interface Colorset {
  name: string;
  // Canonical token map (Stitch-aligned). After parseColorsetYaml the keys
  // come from CANONICAL_TOKENS; deriveCanonical() will fill any gaps when
  // composing a design.md.
  colors: Record<string, string>;
  colorsDark?: Record<string, string>;
  // Theme-specific tokens that don't fit a canonical role (e.g. dial-chassis,
  // console-cap-blue, accent-amber). Referenced from theme prose via
  // {{token}} like always. Never crosses palettes.
  extras?: Record<string, string>;
  extrasDark?: Record<string, string>;
  // Mode-agnostic structural tokens (typography, spacing, radius, border).
  // Same key set across all themes via CANONICAL_STRUCTURAL — themes that
  // omit them get hardcoded defaults at compose time.
  structural?: Record<string, string>;
  // Theme-specific structural tokens that don't fit a canonical structural
  // role. Mirrors the color/extras split.
  structuralExtras?: Record<string, string>;
}

// Hardcoded fallbacks for canonical tokens that almost no current theme
// defines (warning, neutral, text-disabled). Used by deriveCanonical() at
// compose time so the design.md emitted to the LLM is never missing a slot.
const FALLBACK_VALUES: Readonly<Record<string, string>> = {
  warning: "#f59e0b",
  success: "#22c55e",
  error: "#ef4444",
  neutral: "#6b7280",
  "text-disabled": "#9ca3af",
};

// Fill canonical tokens that the source colorset didn't provide. Cross-fills
// primary ↔ accent so themes with a single interactive color satisfy both
// Stitch slots, then layers hardcoded defaults for the rarely-defined ones.
export function deriveCanonical(colors: Record<string, string>): Record<string, string> {
  const out = { ...colors };
  if (!out.primary && out.accent) out.primary = out.accent;
  if (!out.accent && out.primary) out.accent = out.primary;
  if (!out["text-disabled"] && out["text-secondary"]) {
    out["text-disabled"] = out["text-secondary"];
  }
  for (const [k, v] of Object.entries(FALLBACK_VALUES)) {
    if (!out[k]) out[k] = v;
  }
  return out;
}

// Take a raw token map (alias-mixed) and split it into canonical-named colors
// vs extras. The canonical slot wins if the source has both (e.g. defines
// both `bg` and `background`, the latter is preserved).
export function splitCanonical(raw: Record<string, string>): {
  colors: Record<string, string>;
  extras: Record<string, string>;
} {
  const colors: Record<string, string> = {};
  const extras: Record<string, string> = {};
  // First pass: assign anything that already has a canonical name.
  for (const [key, value] of Object.entries(raw)) {
    if (CANONICAL_SET.has(key)) colors[key] = value;
  }
  // Second pass: resolve aliases. If the canonical slot is already taken
  // (either by a direct canonical key in the source, or by an earlier alias),
  // preserve the value under its original name in extras so it isn't lost.
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

// Minimal YAML reader for our colorset shape: flat maps under `colors:`,
// `colorsDark:`, optional `extras:` / `extrasDark:`, plus top-level `name:`.
// We intentionally don't pull in a full YAML dep — the format is fixed and
// machine-generated.
// Same split logic as splitCanonical but against CANONICAL_STRUCTURAL — keeps
// theme-specific structural tokens (e.g. `font-display`) separate from the
// shared vocabulary.
function splitStructural(raw: Record<string, string>): {
  structural: Record<string, string>;
  extras: Record<string, string>;
} {
  const structural: Record<string, string> = {};
  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (STRUCTURAL_SET.has(key)) {
      structural[key] = value;
    } else {
      extras[key] = value;
    }
  }
  return { structural, extras };
}

export function parseColorsetYaml(raw: string): Colorset {
  const nameMatch = raw.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "Untitled";

  const rawColors = readMap(raw, "colors");
  const explicitExtras = hasKey(raw, "extras") ? readMap(raw, "extras") : {};
  const rawDark = hasKey(raw, "colorsDark") ? readMap(raw, "colorsDark") : undefined;
  const explicitExtrasDark = hasKey(raw, "extrasDark") ? readMap(raw, "extrasDark") : {};
  const rawStructural = hasKey(raw, "structural") ? readMap(raw, "structural") : undefined;
  const explicitStructuralExtras = hasKey(raw, "structuralExtras")
    ? readMap(raw, "structuralExtras")
    : {};

  const light = splitCanonical(rawColors);
  const lightExtras = { ...light.extras, ...explicitExtras };

  const result: Colorset = { name, colors: light.colors };
  if (Object.keys(lightExtras).length > 0) result.extras = lightExtras;

  if (rawDark) {
    const dark = splitCanonical(rawDark);
    const darkExtras = { ...dark.extras, ...explicitExtrasDark };
    result.colorsDark = dark.colors;
    if (Object.keys(darkExtras).length > 0) result.extrasDark = darkExtras;
  }

  if (rawStructural) {
    const struct = splitStructural(rawStructural);
    const structExtras = { ...struct.extras, ...explicitStructuralExtras };
    if (Object.keys(struct.structural).length > 0) result.structural = struct.structural;
    if (Object.keys(structExtras).length > 0) result.structuralExtras = structExtras;
  } else if (Object.keys(explicitStructuralExtras).length > 0) {
    result.structuralExtras = explicitStructuralExtras;
  }
  return result;
}

function hasKey(raw: string, key: string): boolean {
  return new RegExp(`^${key}:`, "m").test(raw);
}

function readMap(raw: string, key: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Match `<key>:` at column 0, then capture every indented line until the
  // next top-level (column 0) key or end-of-string.
  const re = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+.*\\n?)*)`, "m");
  const block = raw.match(re);
  if (!block) return out;
  for (const line of block[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    // Quoted form must be tried first — values like "#ff0000" are valid hex
    // colors, not YAML comments. Falling through to the unquoted branch with
    // a `(?:#.*)?` comment matcher would eat the hex value as a comment.
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

// Compose a complete design.md from the structural theme markdown and a
// colorset. The structural .md is expected to:
//   - have a YAML frontmatter with `name:` + non-color tokens (typography,
//     rounded, spacing, components) — but NO `colors:` / `colorsDark:` blocks
//   - reference colors in prose as `{{token}}` placeholders (e.g. `{{primary}}`)
//
// Old-style themes that still carry `colors:` in the frontmatter and inline
// hex in prose pass through unchanged when colorset matches their defaults;
// when a different colorset is supplied, the old `colors:` blocks are
// replaced and any inline hex left in the prose will be inconsistent until
// that theme is migrated.
export function composeDesignMd(structuralMd: string, colorset: Colorset): string {
  // Fill canonical gaps so the LLM never sees a missing slot and so prose
  // references like {{warning}} resolve to a real value.
  const filled: Colorset = {
    ...colorset,
    colors: deriveCanonical(colorset.colors),
    colorsDark: colorset.colorsDark ? deriveCanonical(colorset.colorsDark) : undefined,
    structural: deriveStructural(colorset.structural),
  };
  // Strip the legacy `## Colors` section from the body. Pre-canonical theme
  // .md files list their old token vocabulary (`bg`, `comp-bg`, `accent-amber`,
  // …) with hardcoded oklch/hex values — exactly the kind of contradictory
  // instruction that makes the LLM mix the theme's old palette into the
  // active colorset. The canonical frontmatter + discipline block is the
  // only source of truth now.
  const stripped = stripLegacyColorsSection(structuralMd);
  const withColors = injectColorsIntoFrontmatter(stripped, filled);
  const substituted = substituteTokens(withColors, filled);
  // Append a concrete "use these CSS variables" block so the LLM can't fall
  // back to hex literals from the generic system-prompt example. Without this
  // the model sees `colors:` in frontmatter but defaults to its prior pattern
  // (`bg-[#hex]`) because the structural prose rarely names the exact tokens.
  return substituted + renderTokenDisciplineBlock(filled);
}

// Remove a top-level `## Colors` section and its bullet list from the body.
// Stops at the next `## ` heading (any level-2 sibling) or end-of-string.
// Pre-canonical themes shipped a token reference here that contradicts the
// active colorset whenever theme ≠ colorTheme.
function stripLegacyColorsSection(md: string): string {
  return md.replace(/(^|\n)## Colors\n[\s\S]*?(?=\n## |\n*$)/, "$1").replace(/\n{3,}/g, "\n\n");
}

// Render just the operative `:root { … } @media { … }` CSS block for a
// colorset. Exported so the regenerate-with-this-palette flow can embed the
// literal block in the user message — sending just the palette name leaves
// the LLM guessing hex values from training data instead of using ours.
//
// `includeExtras: false` strips theme-specific tokens (e.g. `wood-frame`,
// `stone-dark`, `gold-base`) from the output. Use this for LLM-facing blocks
// where the goal is full palette swappability — if the LLM bakes bespoke
// tokens into the app, a future palette swap can't override them (the new
// palette doesn't define those names), so the app falls back to stale
// values and only ~30% of the UI restyles. The live runtime push still
// includes extras (default true) so existing apps with bespoke tokens
// remain interactive in the modal.
export function renderRootCssBlock(
  colorset: Colorset,
  options: { includeExtras?: boolean } = {}
): string {
  const includeExtras = options.includeExtras !== false;
  const lightColors = deriveCanonical(colorset.colors);
  const darkColors = colorset.colorsDark ? deriveCanonical(colorset.colorsDark) : undefined;
  const structural = deriveStructural(colorset.structural);

  const cssVars = (record: Record<string, string>) =>
    Object.entries(record)
      .map(([k, v]) => `  --${k}: ${v};`)
      .join("\n");

  // Structural tokens are mode-agnostic so they live in the unconditional
  // `:root` block alongside the light colors. The dark @media block only
  // overrides colors that flip on theme.
  const allLight = {
    ...(includeExtras ? colorset.extras ?? {} : {}),
    ...lightColors,
    ...structural,
    ...(includeExtras ? colorset.structuralExtras ?? {} : {}),
  };
  const allDark =
    darkColors || (includeExtras && colorset.extrasDark)
      ? {
          ...(includeExtras ? colorset.extrasDark ?? {} : {}),
          ...(darkColors ?? {}),
        }
      : undefined;

  const darkBlock = allDark
    ? `\n@media (prefers-color-scheme: dark) {\n  :root {\n${cssVars(allDark).replace(/^/gm, "  ")}\n  }\n}`
    : "";

  return `:root {\n${cssVars(allLight)}\n}${darkBlock}`;
}

// Concrete CSS + classNames example pinning the LLM to the canonical token
// vocabulary. Emitted at the end of the composed design.md so the model reads
// it last (and treats it as the operative styling instruction).
function renderTokenDisciplineBlock(colorset: Colorset): string {
  // `includeExtras: false` — extras (gold-base, stone-dark, wood-frame, …)
  // are theme-specific. If the LLM bakes them into the app, a palette swap
  // can't override them and only ~30% of the UI restyles. The contract is
  // canonical + structural ONLY in the app's :root.
  const cssBlock = renderRootCssBlock(colorset, { includeExtras: false });
  const hasDark = colorset.colorsDark !== undefined;

  const tokenList = Object.keys(deriveCanonical(colorset.colors))
    .map((k) => `  ${k}: 'bg-[var(--${k})]',`)
    .join("\n");

  const darkRule = hasDark
    ? "A dark-mode `@media` block IS provided below — include it verbatim."
    : "No dark-mode block is provided. Do NOT invent one. The theme is single-mode.";

  return `\n\n## Required CSS variables — THIS IS THE OPERATIVE STYLING INSTRUCTION

The \`<style>\` block below is the single source of truth for **every visual
token** in the generated app — colors, font families, spacing, radius, and
border width. Copy it **VERBATIM** into a \`<style>\` tag at the top of the
app. Do not change values, do not round or approximate, do not "interpret"
the palette description from the prose into your own values. Whatever this
block says is what the app must look like.

**DO NOT introduce theme-specific tokens into \`:root\`.** The block below
contains only the canonical vocabulary that every palette guarantees. If you
add bespoke names like \`--gold-base\`, \`--stone-dark\`, \`--crimson\`,
\`--wood-frame\`, etc., the user's palette swap can't override them and the
app will look stuck on the original theme. Express the theme's aesthetic
through the canonical names (\`--accent\`, \`--surface\`, \`--primary\`, etc.)
— do not introduce new ones.

Reference the variables via Tailwind's bracket notation:
- Colors: \`bg-[var(--background)]\`, \`text-[var(--text-primary)]\`, \`border-[var(--border)]\`
- Structural: \`font-[var(--font-family)]\`, \`rounded-[var(--radius)]\`, \`p-[var(--spacing)]\`, \`border-[length:var(--border-width)]\`

**FORBIDDEN — these silently break palette swaps**:
- \`bg-[#hex]\`, \`bg-[oklch(...)]\`, \`bg-[rgba(...)]\`, \`bg-[hsl(...)]\` — any color literal in a bracket class
- \`text-[#hex]\`, \`text-[oklch(...)]\`, \`text-[rgba(...)]\`, \`border-[#hex]\`, etc.
- \`bg-[var(--gold-base)]\`, \`bg-[var(--stone-dark)]\` — any var() pointing to a name not in the \`:root\` block above
- \`rounded-md\`, \`p-4\`, \`text-lg\`, \`font-mono\` — built-in Tailwind tokens for size/spacing/typography (use \`rounded-[var(--radius)]\`, \`p-[var(--spacing)]\`, etc.)

Translucency and gradients: when you need a translucent surface, use
\`bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]\` or stack a
semi-transparent overlay — do NOT inline an \`oklch(... / 0.9)\` literal.
Same for gradients: build them from \`var(--canonical)\` colors.

Every color and structural value in the \`classNames\` object MUST resolve to
one of the canonical variables above. If you find yourself reaching for a
literal hex or oklch, ask which canonical role it plays (\`accent\`,
\`success\`, \`warning\`, \`surface\`, etc.) and use that variable instead.

${darkRule}

\`\`\`html
<style>
${cssBlock}
</style>
\`\`\`

Example \`classNames\` skeleton bound to the theme (rename keys to taste, but
keep the \`var(--...)\` shape):

\`\`\`js
const c = {
${tokenList}
  container: 'p-[var(--spacing)] rounded-[var(--radius)] border-[length:var(--border-width)]',
  body: 'font-[var(--font-family)] text-[length:var(--font-size-base)]',
};
\`\`\`
`;
}

function injectColorsIntoFrontmatter(md: string, colorset: Colorset): string {
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return md;
  const original = fmMatch[1];

  // Drop any existing colors/extras/structural blocks so the colorset is the
  // sole source of truth in the composed output.
  const stripped = [
    "colorsDark",
    "colors",
    "extrasDark",
    "extras",
    "structuralExtras",
    "structural",
  ].reduce((acc, key) => stripBlock(acc, key), original);

  const blocks: string[] = [];
  blocks.push(renderColorBlock("colors", colorset.colors));
  if (colorset.colorsDark) blocks.push(renderColorBlock("colorsDark", colorset.colorsDark));
  if (colorset.extras && Object.keys(colorset.extras).length > 0) {
    blocks.push(renderColorBlock("extras", colorset.extras));
  }
  if (colorset.extrasDark && Object.keys(colorset.extrasDark).length > 0) {
    blocks.push(renderColorBlock("extrasDark", colorset.extrasDark));
  }
  // Structural is always emitted (filled with defaults via deriveStructural at
  // compose time) so every theme advertises the same 8 slots.
  blocks.push(renderColorBlock("structural", deriveStructural(colorset.structural)));
  if (colorset.structuralExtras && Object.keys(colorset.structuralExtras).length > 0) {
    blocks.push(renderColorBlock("structuralExtras", colorset.structuralExtras));
  }
  const blocksYaml = blocks.join("");

  // Insert color blocks right after `name:` if present, otherwise at the top.
  // Keeps the frontmatter ordering predictable for diffs and snapshots.
  let nextFm: string;
  const nameLine = stripped.match(/^name:.*$/m);
  if (nameLine) {
    const idx = stripped.indexOf(nameLine[0]) + nameLine[0].length;
    nextFm = stripped.slice(0, idx) + "\n" + blocksYaml + stripped.slice(idx);
  } else {
    nextFm = blocksYaml + stripped;
  }
  // Collapse runs of blank lines that the strip/insert may have produced.
  nextFm = nextFm.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
  return md.replace(fmMatch[0], `---\n${nextFm}\n---`);
}

function stripBlock(fm: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+.*\\n?)*)`, "m");
  return fm.replace(re, "");
}

function renderColorBlock(key: string, colors: Record<string, string>): string {
  const lines = [`${key}:`];
  for (const [k, v] of Object.entries(colors)) {
    lines.push(`  ${k}: "${v}"`);
  }
  return lines.join("\n") + "\n";
}

// Replace `{{token}}` occurrences in the markdown body with their resolved
// color value. Looks up canonical names first, then extras, then falls back
// to alias resolution so old themes that still reference `{{bg}}`, `{{fg}}`,
// `{{comp-bg}}`, etc. keep working without rewriting the prose.
//
// Tokens that don't resolve are left as `{{token}}` so the substitution
// failure is visible in the emitted design.md rather than silently
// corrupting it.
function substituteTokens(md: string, colorset: Colorset): string {
  const merged: Record<string, string> = {
    ...(colorset.extras ?? {}),
    ...colorset.colors,
    ...(colorset.structuralExtras ?? {}),
    ...(colorset.structural ?? {}),
  };
  return md.replace(/\{\{([\w-]+)\}\}/g, (raw, token) => {
    if (merged[token] !== undefined) return merged[token];
    const canonical = TOKEN_ALIASES[token];
    if (canonical && merged[canonical] !== undefined) return merged[canonical];
    return raw;
  });
}
