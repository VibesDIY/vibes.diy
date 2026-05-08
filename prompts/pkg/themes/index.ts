export interface VibesTheme {
  slug: string;
  name: string;
  accentColor: string;
  bgColor: string;
  bodyFont?: string;
}

export const vibesThemes: VibesTheme[] = [
  { slug: "aether", name: "Aether Brass", accentColor: "#cfa562", bgColor: "#dcbfa6", bodyFont: "'Special Elite', monospace" },
  {
    slug: "archive",
    name: "Archive",
    accentColor: "oklch(0.35 0.04 50)",
    bgColor: "oklch(0.95 0.01 70)",
    bodyFont: "'Inter', sans-serif",
  },
  {
    slug: "atelier",
    name: "Atelier Studio",
    accentColor: "oklch(0.65 0.18 55)",
    bgColor: "oklch(0.95 0.03 70)",
    bodyFont: "'Playfair Display', serif",
  },
  {
    slug: "atlas",
    name: "Atlas Reference",
    accentColor: "oklch(0.62 0.24 25)",
    bgColor: "oklch(1.00 0 0)",
    bodyFont: "var(--font-sans)",
  },
  {
    slug: "broadsheet",
    name: "Broadsheet",
    accentColor: "#666",
    bgColor: "#fff",
    bodyFont: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  { slug: "brutalist", name: "Neobrutalist", accentColor: "#DA291C", bgColor: "#f5f0e0", bodyFont: "'Space Grotesk', sans-serif" },
  {
    slug: "capsule",
    name: "Capsule Split",
    accentColor: "oklch(0.00 0 0)",
    bgColor: "oklch(0.89 0.20 110)",
    bodyFont: "var(--font-main)",
  },
  {
    slug: "carbon",
    name: "Carbon Panel",
    accentColor: "oklch(0.79 0.18 75)",
    bgColor: "oklch(0.18 0.005 285)",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  { slug: "chrome", name: "Chrome Terminal", accentColor: "#ff003c", bgColor: "#000000", bodyFont: "'Rajdhani', sans-serif" },
  { slug: "chrono", name: "Chrono", accentColor: "#6c8ee6", bgColor: "#dde1e7", bodyFont: "'Inter', sans-serif" },
  {
    slug: "codex",
    name: "Elder Codex",
    accentColor: "oklch(0.17 0.000 0)",
    bgColor: "oklch(0.06 0.000 0)",
    bodyFont: "'Cinzel', serif",
  },
  {
    slug: "computer-angel-heaven",
    name: "Computer Angel Heaven",
    accentColor: "oklch(0.78 0.12 85)",
    bgColor: "oklch(0.96 0.008 80)",
    bodyFont: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  },
  {
    slug: "console",
    name: "Console Rack",
    accentColor: "oklch(0.58 0.20 35)",
    bgColor: "oklch(0.93 0.003 265)",
    bodyFont: "var(--font-ui)",
  },
  {
    slug: "default",
    name: "Default",
    accentColor: "oklch(0.72 0.18 70)",
    bgColor: "oklch(0.18 0.04 60)",
    bodyFont: "'Inter', sans-serif",
  },
  {
    slug: "desktop",
    name: "Desktop Retro",
    accentColor: "oklch(0.11 0.01 250)",
    bgColor: "#fff",
    bodyFont: "'JetBrains Mono', monospace",
  },
  {
    slug: "dial",
    name: "Dial Apparatus",
    accentColor: "oklch(0.62 0.24 28)",
    bgColor: "oklch(0.24 0.01 260)",
    bodyFont: "var(--font-ui)",
  },
  {
    slug: "dossier",
    name: "Dossier Card",
    accentColor: "#666",
    bgColor: "oklch(0.16 0.000 0)",
    bodyFont: "'Roboto Mono', monospace",
  },
  { slug: "edge", name: "EDGE INTERFACE", accentColor: "#ff0077", bgColor: "#fff", bodyFont: "var(--font-body)" },
  {
    slug: "guild",
    name: "Guild Ledger",
    accentColor: "oklch(0.60 0.13 80)",
    bgColor: "oklch(0.10 0.03 260)",
    bodyFont: "'Cinzel', serif",
  },
  { slug: "hearth", name: "Hearth Sim", accentColor: "oklch(0.38 0.17 295)", bgColor: "#fff", bodyFont: "'Nunito', sans-serif" },
  {
    slug: "industrial",
    name: "Industrial",
    accentColor: "oklch(0.90 0.20 110)",
    bgColor: "oklch(0.88 0.01 90)",
    bodyFont: "'Inter', sans-serif",
  },
  {
    slug: "matrix",
    name: "Matrix Status",
    accentColor: "oklch(0.79 0.21 152)",
    bgColor: "oklch(0.16 0.000 0)",
    bodyFont: "'VT323', monospace",
  },
  {
    slug: "mesh",
    name: "Mesh Void",
    accentColor: "oklch(0.87 0.28 145)",
    bgColor: "#fff",
    bodyFont: "'Inter', -apple-system, sans-serif",
  },
  {
    slug: "neomario",
    name: "NeoMario",
    accentColor: "oklch(0.55 0.24 28)",
    bgColor: "oklch(0.96 0.01 90)",
    bodyFont: "'Space Grotesk', sans-serif",
  },
  { slug: "neon", name: "Neon Arcade", accentColor: "#f93c94", bgColor: "#fff", bodyFont: "'Rajdhani', sans-serif" },
  {
    slug: "nexus",
    name: "Nexus Grid",
    accentColor: "#D4FF00",
    bgColor: "#000000",
    bodyFont: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
  },
  {
    slug: "opus",
    name: "Opus Cabinet",
    accentColor: "oklch(0.12 0.000 0)",
    bgColor: "oklch(0.06 0.000 0)",
    bodyFont: "'Cinzel', serif",
  },
  {
    slug: "orbit",
    name: "Orbit Dashboard",
    accentColor: "oklch(0.79 0.21 152)",
    bgColor: "#fff",
    bodyFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    slug: "palate",
    name: "Palate Notes",
    accentColor: "oklch(0.93 0.006 265)",
    bgColor: "oklch(0.17 0.000 0)",
    bodyFont: "'Cormorant Garamond', serif",
  },
  {
    slug: "pitch",
    name: "Pitch",
    accentColor: "oklch(0.86 0.18 90)",
    bgColor: "oklch(0.22 0.05 163)",
    bodyFont: "'Space Grotesk', sans-serif",
  },
  {
    slug: "poster",
    name: "Poster",
    accentColor: "oklch(0.65 0.18 290)",
    bgColor: "oklch(0.11 0.01 270)",
    bodyFont: "'Inter', sans-serif",
  },
  {
    slug: "proof",
    name: "Proof Sheet",
    accentColor: "oklch(1.00 0.000 0 / 0.1)",
    bgColor: "oklch(0.14 0.000 0)",
    bodyFont: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
  {
    slug: "recon",
    name: "Recon Grid",
    accentColor: "oklch(0.64 0.24 25)",
    bgColor: "oklch(0.00 0.000 0)",
    bodyFont: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  {
    slug: "rift",
    name: "Rift Portal",
    accentColor: "oklch(0.88 0.27 128)",
    bgColor: "oklch(0.07 0.02 280)",
    bodyFont: "'Orbitron', sans-serif",
  },
  {
    slug: "rune",
    name: "Rune Interface",
    accentColor: "#020406",
    bgColor: "#fff",
    bodyFont: "'Cormorant Garamond', Georgia, serif",
  },
  { slug: "scrapbook", name: "Scrapbook", accentColor: "oklch(0.93 0.03 130)", bgColor: "#fff", bodyFont: "'Inter', sans-serif" },
  {
    slug: "sensor",
    name: "Sensor Dashboard",
    accentColor: "oklch(0.53 0.22 25)",
    bgColor: "oklch(0.10 0.003 264)",
    bodyFont: "'IBM Plex Mono', ui-monospace, monospace",
  },
  { slug: "signal", name: "Signal", accentColor: "#ffffff", bgColor: "#030303", bodyFont: "'Inter', sans-serif" },
  { slug: "slab", name: "Slab Concrete", accentColor: "oklch(0.88 0.000 0)", bgColor: "#fff", bodyFont: "'Inter', sans-serif" },
  { slug: "specimen", name: "Specimen", accentColor: "#666", bgColor: "#fff", bodyFont: "'Inter', sans-serif" },
  {
    slug: "terminal",
    name: "Terminal CRT",
    accentColor: "oklch(0.00 0.000 0 / 0.85)",
    bgColor: "oklch(0.16 0.000 0)",
    bodyFont: "'VT323', monospace",
  },
  {
    slug: "vault",
    name: "Vault",
    accentColor: "oklch(0.72 0.15 75)",
    bgColor: "oklch(0.08 0.03 280)",
    bodyFont: "'Inter', sans-serif",
  },
  {
    slug: "winter-sports",
    name: "Winter Sports",
    accentColor: "oklch(0.55 0.19 250)",
    bgColor: "oklch(0.99 0.003 240)",
    bodyFont: "'Inter', sans-serif",
  },
  { slug: "zine", name: "Zine Cut", accentColor: "oklch(0.05 0 0)", bgColor: "oklch(0.96 0.005 100)", bodyFont: "var(--f-type)" },
];

let _names: Set<string> | undefined;
export function getThemeCatalogNames(): Set<string> {
  if (!_names) _names = new Set(vibesThemes.map((t) => t.slug));
  return _names;
}

export function getThemeBySlug(slug: string): VibesTheme | undefined {
  return vibesThemes.find((t) => t.slug === slug);
}

/**
 * Parse a DESIGN.md file (YAML frontmatter + markdown body) into a VibesTheme.
 * Used by the picker modal to import user-supplied .md files. Imported themes
 * apply session-only and are not persisted; the parsed accent/bg are best-effort
 * from the colors block.
 */
export function parseDesignMd(content: string, slug?: string): VibesTheme {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : "";
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : slug || "Custom Theme";
  const colorBlock = frontmatter.match(/^colors:\n((?:\s+.+\n)*)/m);
  const colors: Record<string, string> = {};
  if (colorBlock) {
    for (const line of colorBlock[1].split("\n")) {
      const m = line.match(/^\s+([\w-]+):\s*"?([^"\n]+)"?$/);
      if (m) colors[m[1]] = m[2].trim();
    }
  }
  const accentColor = colors["primary"] || colors["accent"] || colors["tertiary"] || Object.values(colors)[2] || "#666";
  const bgColor = colors["background"] || colors["surface"] || colors["neutral"] || Object.values(colors)[0] || "#fff";
  const fontMatch = frontmatter.match(/fontFamily:\s*(.+)$/m);
  const bodyFont = fontMatch ? fontMatch[1].trim() : undefined;
  return {
    slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
    name,
    accentColor,
    bgColor,
    bodyFont,
  };
}
