export interface StylePrompt {
  name: string;
  prompt: string;
}

export const stylePrompts: StylePrompt[] = [
  // "brutalist web" remains the intended default. The default is now selected by name
  // (see DEFAULT_STYLE_NAME below), not by array order. Order here only affects UI
  // suggestion ordering in Settings.
  {
    name: "brutalist web",
    prompt:
      'THEME: Neobrutalist — Neobrutalist Design System. A bold, retro-arcade-inspired neobrutalist theme. Hard edges, chunky black borders, thick offset drop shadows, vivid primary color blocks, and uppercase display typography. The mood is playful and unapologetically loud without leaning on direct IP references — it is "level dashboard" energy: raw, graphic, readable, kinetic.\n\nCOLOR PALETTE (oklch): --bg: oklch(0.96 0.01 90) warm off-white canvas; --card-bg: oklch(1.00 0 0) pure white surfaces; --text: oklch(0.15 0.02 280) near-black ink, cool undertone; --border: oklch(0.15 0.02 280) same as text — every stroke is bold; --muted: oklch(0.50 0.02 280) secondary labels; --accent/--red: oklch(0.55 0.24 28) primary action/danger; --yellow: oklch(0.85 0.18 85) highlight/hover; --yellow-dark: oklch(0.75 0.16 85); --green: oklch(0.62 0.19 145) success/active; --blue: oklch(0.52 0.18 255) info/informational accents; --accent-light: oklch(0.55 0.24 28 / 0.1).\n\nTOKENS: --radius: 4px (tiny, never pill-shaped); --shadow: 4px 4px 0px var(--border); --shadow-sm: 3px 3px 0px var(--border).\n\nTYPOGRAPHY: Primary: "Space Grotesk", sans-serif (400, 500, 600, 700). Mono: "JetBrains Mono", monospace (400, 500, 700) — for stats, numbers, tabular data. Loaded from Google Fonts only, no other external deps. Headings are UPPERCASE with tight tracking (-0.02em) and heavy weight (700). Section labels: 0.65rem, uppercase, letter-spacing 0.15em, muted color. Nav/button labels: 0.7–0.8rem, uppercase, letter-spacing 0.05–0.08em.\n\nSURFACE & BORDER LANGUAGE: Every primary surface (nav, cards, hero, modal, inputs, buttons) has a solid 3px var(--border) outline and border-radius of 4px. No gradients on strokes, no thin hairlines. Every elevated surface carries a hard offset shadow — 4px 4px 0px var(--border) by default, 3px 3px for smaller chips, 6px 6px on hover for lift, 8px 8px on modals. Shadows are NEVER blurred. Hover pattern: transform: translate(-2px, -2px) combined with a larger hard shadow — gives a "card pops forward" feel. Active/pressed state flips to translate(2px, 2px) with box-shadow: none — the object visibly slams back down. Transitions: 0.15s for micro-interactions, 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) for toggle knobs (slight overshoot).\n\nLAYOUT: A single centered column, max-width: 920px, padding 3rem 2rem, position: relative; z-index: 10; so it sits above ambient background decorations.\n\nAMBIENT BACKGROUND: Fixed inset grid: two linear-gradients at 60px × 60px with oklch(0.15 0.02 280 / 0.04) — subtle graph-paper feel. 8 floating geometric blocks (.float-block-1..8) placed across the viewport edges, sizes 25–80px, in --red/--yellow/--green/--blue, some square some circular (border-radius: 50%), opacity 0.15–0.3 so they don\'t overpower content. 2 floating plus/cross shapes built from ::before/::after pseudo-elements (40×40, arms 10px thick) — var(--border) color, low opacity. 2 floating diamonds — 30×30 --yellow squares with 3px borders, rotated 45deg. Keyframes (all on loops 5–12s, ease-in-out or linear): drift-spin-1, drift-spin-2, drift-bounce, drift-diagonal, drift-zigzag, drift-pulse, drift-diamond. The shapes should drift, not race.\n\nSECTION COMPOSITION: 1. NAV: Card-style bar with 3px border, shadow, 4px radius. Left: logo = three 12×12 squares (red/yellow/green) + uppercase brand text. Right: .nav-link pill-looking-but-square chips + .status-badge in --green with pulsing 7px dot. 2. HERO: Big bordered card with .hero-accent-bar along the top: a 6px horizontal rainbow split into four equal segments — red 0–25%, yellow 25–50%, green 50–75%, blue 75–100%. Big clamped uppercase title with .hero-text-shadow duplicate offset 5px/5px in --red, opacity 0.5. 3. STAT ROW: 4-column grid of .stat-cards (collapses to 2 then 1 on small screens). Each card has colored header bar: child 1 = --red (white text), 2 = --yellow (dark text), 3 = --blue (white text), 4 = --green (dark text). Body shows big mono number + small uppercase unit label. 4. TABLE: Full-bleed inside bordered card. th: 0.6rem uppercase, 2px bottom border. td: 0.82rem, thin separators. Columns 3 & 4 use JetBrains Mono. Row hover fills with --yellow instantly. Badge styles: badge-active (--green), badge-pending (--yellow), badge-locked (neutral gray). 5. FORM + CONTROLS GRID: 2-column grid of cards. Left: text input + select + progress bar + primary/secondary buttons. Inputs lift on focus with translate(-2px,-2px) + shadow. Progress bar has repeating striped gradient at -45° in --green. Right: checkboxes (22×22, 3px border, --green when checked) + toggles (48×26, 3px border, 4px radius, --yellow when on, knob translates with overshoot) + tag row in four colors. 6. ACTIONS CARD: Flex row with .btn-primary (--red bg, white text, 4×4 shadow), .btn-secondary (--yellow bg, 3×3 shadow), .btn-ghost (card-bg, no shadow, gains 3×3 on hover). 7. MODAL: Overlay oklch(0.15 0.02 280 / 0.6). Modal card: 3px border, 8×8 hard shadow, entry animation modal-pop. .modal-bar: --blue title strip with white text.\n\nINTERACTION: Nothing eases slowly. All hovers/presses resolve in ≤0.2s. Hover lifts up-and-left; press slams down-and-right. Nothing uses soft blur. Every shadow is a discrete offset block. Rounded corners are tiny (4px) everywhere. Color use: --red is primary/danger; --yellow is highlight/warning; --green is success/status; --blue is informational. Don\'t tint surfaces — keep all cards --card-bg white.\n\nACCESSIBILITY: Body text ≥0.82rem, section labels ≥0.6rem. Strong contrast (text on red → white; text on yellow → ink; text on green → ink; text on blue → white). aria-hidden the decorative .hero-text-shadow.\n\nRESPONSIVENESS: ≤700px: stat row collapses to 2 columns, form grid to 1 column. ≤500px: nav stacks vertically, stat row to single column.\n\nFONTS: <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">. Deliver a single self-contained HTML file (no external deps beyond the Google Fonts link) that applies this theme.',
  },
  {
    name: "memphis",
    prompt:
      "Create a UI theme inspired by the Memphis Group and Studio Alchimia from the 1980s. Incorporate bold, playful geometric shapes (squiggles, triangles, circles), vibrant primary colors (red, blue, yellow) with contrasting pastels (pink, mint, lavender), and asymmetrical layouts. Use quirky patterns like polka dots, zigzags, and terrazzo textures. Ensure a retro-futuristic vibe with a mix of matte and glossy finishes, evoking a whimsical yet functional design. Secretly name the theme 'Memphis Alchemy' to reflect its roots in Ettore Sotsass's vision and global 1980s influences. Make sure the app background has some kind of charming patterned background using memphis styled dots or squiggly lines. Use thick \"neo-brutalism\" style borders for style to enhance legibility. Make sure to retain high contrast in your use of colors. Light background are better than dark ones. Use these colors: #70d6ff #ff70a6 #ff9770 #ffd670 #e9ff70 #242424 #ffffff Never use white text.",
  },
  {
    name: "synthwave",
    prompt: "80s digital aesthetic",
  },
  {
    name: "organic UI",
    prompt: "natural, fluid forms",
  },
  {
    name: "maximalist",
    prompt: "dense, decorative",
  },
  {
    name: "skeuomorphic",
    prompt: "real-world mimics",
  },
  {
    name: "flat design",
    prompt: "clean, 2D shapes",
  },
  {
    name: "bauhaus",
    prompt: "geometric modernism",
  },
  {
    name: "glitchcore",
    prompt: "decentering expectations",
  },
  {
    name: "paper cutout",
    prompt: "layered, tactile",
  },
  {
    name: "viridian",
    prompt:
      "Create a vibrant UI theme inspired by Bruce Sterling's Viridian Design Movement, embracing a futuristic green aesthetic with subtle animations and dynamic interactivity. Integrate biomorphic, floating UI elements with organic shapes that gently pulse or drift, reflecting themes of biological complexity, decay, and renewal. Employ frosted glass backgrounds with delicate blur effects, highlighting sensor-like data streams beneath, representing Sterling's \"make the invisible visible\" ethos.\n\nUse gradients and layers of soft greens accented by energetic data-inspired colors (#70d6ff, #ff70a6, #ff9770, #ffd670, #e9ff70), alongside crisp white (#ffffff) and dark contrast (#242424), ensuring legibility and visual appeal. UI borders should feel substantial, neo-brutalist, and clear, anchoring the ephemeral visuals and animations.\n\nThe background should subtly animate, evoking cellular activity, digital pulse, or ecological sensor feedback, reinforcing Viridian's fascination with tangible cyberspace and biomorphic tech aesthetics.\n\nSecretly name this theme \"Viridian Pulse\", capturing Sterling's original playful-yet-serious blend of provocative futurism and stylish eco-consciousness.",
  },
];

// Explicit default selection (stable regardless of array order)
export const DEFAULT_STYLE_NAME = "brutalist web" as const;

// Build a name → style map once and enforce uniqueness to avoid subtle bugs
const nameToStyle = new Map<string, StylePrompt>();
for (const s of stylePrompts) {
  if (nameToStyle.has(s.name)) {
    throw new Error(`Duplicate style name detected: "${s.name}". Style names must be unique.`);
  }
  nameToStyle.set(s.name, s);
}

// Derive the default prompt via map lookup (order-independent)
export const defaultStylePrompt = (() => {
  const entry = nameToStyle.get(DEFAULT_STYLE_NAME);
  if (!entry) {
    const available = Array.from(nameToStyle.keys()).join(", ");
    throw new Error(
      `DEFAULT_STYLE_NAME "${DEFAULT_STYLE_NAME}" not found in stylePrompts. Available names: ${available}. Update DEFAULT_STYLE_NAME or the style list.`
    );
  }
  return entry.prompt;
})();
