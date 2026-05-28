---
name: Chrome Terminal
colorsLight:
  # Light mode — "chrome at dawn". Same fonts, same red accent role,
  # darker for legibility on white. Glow text-shadow drops to a faint
  # red drop, since neon glow doesn't read on a bright background.
  bg: "oklch(0.97 0.005 0)"
  bg-surface: "#ffffff"
  bg-panel: "oklch(0.95 0.02 25)"
  bg-dark: "oklch(0.93 0.04 25)"
  bg-footer: "oklch(0.95 0.02 25)"
  neon-red: "oklch(0.55 0.24 28)"
  neon-yellow: "oklch(0.78 0.16 90)"
  neon-cyan: "oklch(0.50 0.15 220)"
  border: "oklch(0.45 0.10 25)"
  border-red: "oklch(0.55 0.24 28 / 0.55)"
  text: "oklch(0.18 0.04 25)"
  text-dim: "oklch(0.32 0.04 25)"
  text-muted: "oklch(0.45 0.04 25)"
typography:
  body-md:
    fontFamily: Rajdhani
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Chrome Terminal design system — a black-canvas neon-red terminal that **respects the visitor's system color scheme**: dark by default (canonical), with a "chrome-at-dawn" light variant that auto-applies on `prefers-color-scheme: light`. Both modes share Orbitron (display), Rajdhani (body), and Share Tech Mono (mono telemetry) — only the colors and the glow weight shift.

## Colors

The theme defines two color sets, dark (top-level `colors`) and light (`colorsLight`). Apply them via a `@media (prefers-color-scheme: light)` block (in a `<style>` tag, in CSS variables, or in Tailwind dark-mode classes — whichever the surrounding code uses). Never hard-code one mode only — components must read correctly in both.

### Dark tokens (canonical)

- **bg** (#000000): Page background — pure black.
- **bg-surface** (#171717): Default raised surface.
- **bg-panel** (#2a0a18): Panel / card background — faint red undertone.
- **bg-dark** (#12050e): Lowered surface.
- **bg-footer** (#1a050c): Footer / status bars.
- **neon-red** (#ff003c): Primary actions, display type, alerts. Glows.
- **neon-yellow** (#fcee0a): Highlights, eyebrow labels.
- **neon-cyan** (#00f0ff): Secondary accents, links, "ok" status.
- **border** (#3d1326): Default border — dark wine.
- **border-red** (rgba(255, 0, 60, 0.5)): Glowing edge for buttons, focus rings.
- **text** (#ffffff): Primary text.
- **text-dim** (#d1d1d1): Secondary text.
- **text-muted** (#a3a3a3): Muted captions.

### Light tokens

- **bg** (oklch(0.97 0.005 0)): Off-white page background.
- **bg-surface** (#ffffff): Pure white raised surface.
- **bg-panel** (oklch(0.95 0.02 25)): Faint warm panel.
- **bg-dark** (oklch(0.93 0.04 25)): Warm card surface.
- **bg-footer** (oklch(0.95 0.02 25)): Footer.
- **neon-red** (oklch(0.55 0.24 28)): Saturated red — darker for legibility on white.
- **neon-yellow** (oklch(0.78 0.16 90)): Warm gold for highlights.
- **neon-cyan** (oklch(0.50 0.15 220)): Deeper cyan, reads on white.
- **border** (oklch(0.45 0.10 25)): Solid border with subtle red.
- **border-red** (oklch(0.55 0.24 28 / 0.55)): Translucent red edge.
- **text** (oklch(0.18 0.04 25)): Near-black with red undertone.
- **text-dim** (oklch(0.32 0.04 25)): Secondary.
- **text-muted** (oklch(0.45 0.04 25)): Muted.

## Typography

Load fonts from Google Fonts: Orbitron, Rajdhani, Share Tech Mono. Use `display=optional`.
Primary body font: `'Rajdhani', sans-serif`. Display: `'Orbitron', sans-serif` (uppercase, letter-spacing 0.04em). Mono telemetry: `'Share Tech Mono', monospace`.

## Glow Effects

In dark mode, the display title carries a layered red text-shadow (`0 0 30px rgba(255,0,60,0.6), 0 0 8px rgba(255,0,60,0.9)`). In light mode, glow on bright backgrounds reads as muddy — drop the layered shadow and use a single faint drop (`0 1px 0 oklch(0.55 0.24 28 / 0.25)`) or none at all.

## Components

Apply the color tokens consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast in **both modes**.

The recommended pattern for inline-styled components — set CSS variables once on `:root`:

```js
const themeStyle = `
  :root {
    --bg: #000000;
    --bg-surface: #171717;
    --bg-panel: #2a0a18;
    --bg-dark: #12050e;
    --neon-red: #ff003c;
    --neon-yellow: #fcee0a;
    --neon-cyan: #00f0ff;
    --border: #3d1326;
    --text: #ffffff;
    --text-dim: #d1d1d1;
    --text-muted: #a3a3a3;
    --glow: 0 0 30px rgba(255,0,60,0.6), 0 0 8px rgba(255,0,60,0.9);
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: oklch(0.97 0.005 0);
      --bg-surface: #ffffff;
      --bg-panel: oklch(0.95 0.02 25);
      --bg-dark: oklch(0.93 0.04 25);
      --neon-red: oklch(0.55 0.24 28);
      --neon-yellow: oklch(0.78 0.16 90);
      --neon-cyan: oklch(0.50 0.15 220);
      --border: oklch(0.45 0.10 25);
      --text: oklch(0.18 0.04 25);
      --text-dim: oklch(0.32 0.04 25);
      --text-muted: oklch(0.45 0.04 25);
      --glow: 0 1px 0 oklch(0.55 0.24 28 / 0.25);
    }
  }
`;
```

Then reference `var(--bg)`, `var(--neon-red)`, `var(--glow)`, etc. in inline styles or className-driven CSS.
