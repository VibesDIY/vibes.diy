// Theme colorsets. The structural theme markdown lives in `<slug>.md`; the
// colors (light + dark token values) live separately in `colors/<slug>.yaml`.
// Composing them at codegen time lets a single structural theme combine with
// any colorset without LLM contradictions — see ticket #1853.
//
// The export format we hand to the LLM (and to users) is still a single
// design.md: composeDesignMd() re-injects the colorset into the structural
// frontmatter and substitutes `{{token}}` placeholders in the markdown body,
// producing a complete design.md that is byte-equivalent in shape to the
// pre-split format.

export interface Colorset {
  name: string;
  colors: Record<string, string>;
  colorsDark?: Record<string, string>;
}

// Minimal YAML reader for our colorset shape: a flat map under `colors:` and
// optional `colorsDark:` plus a top-level `name:`. We intentionally don't pull
// in a full YAML dep — the format is fixed and machine-generated.
export function parseColorsetYaml(raw: string): Colorset {
  const nameMatch = raw.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : "Untitled";
  const colors = readMap(raw, "colors");
  const colorsDark = hasKey(raw, "colorsDark") ? readMap(raw, "colorsDark") : undefined;
  return { name, colors, colorsDark };
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
  const withColors = injectColorsIntoFrontmatter(structuralMd, colorset);
  return substituteTokens(withColors, colorset);
}

function injectColorsIntoFrontmatter(md: string, colorset: Colorset): string {
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return md;
  const original = fmMatch[1];

  // Drop any existing colors:/colorsDark: blocks so the colorset is the sole
  // source of truth in the composed output.
  const stripped = stripBlock(stripBlock(original, "colorsDark"), "colors");

  const colorsYaml = renderColorBlock("colors", colorset.colors);
  const darkYaml = colorset.colorsDark ? renderColorBlock("colorsDark", colorset.colorsDark) : "";

  // Insert color blocks right after `name:` if present, otherwise at the top.
  // Keeps the frontmatter ordering predictable for diffs and snapshots.
  let nextFm: string;
  const nameLine = stripped.match(/^name:.*$/m);
  if (nameLine) {
    const idx = stripped.indexOf(nameLine[0]) + nameLine[0].length;
    nextFm = stripped.slice(0, idx) + "\n" + colorsYaml + (darkYaml ? darkYaml : "") + stripped.slice(idx);
  } else {
    nextFm = colorsYaml + (darkYaml ? darkYaml : "") + stripped;
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
// color value. We prefer light-mode values for prose substitution since the
// prose typically describes a single canonical value; dark-mode values are
// surfaced via the frontmatter (which the LLM reads as structured tokens).
//
// Tokens that aren't found in the colorset are left as `{{token}}` so the
// substitution failure is visible in the emitted design.md rather than
// silently corrupting it.
function substituteTokens(md: string, colorset: Colorset): string {
  return md.replace(/\{\{([\w-]+)\}\}/g, (raw, token) => {
    const value = colorset.colors[token];
    return value ?? raw;
  });
}
