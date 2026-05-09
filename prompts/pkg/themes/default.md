---
name: Default
colors:
  # Light mode (the canonical "default" — calm warm canvas, dark ink, golden action color)
  bg: "oklch(0.97 0.01 80)"
  card-bg: "oklch(1.00 0 0)"
  text: "oklch(0.20 0.02 60)"
  accent: "oklch(0.62 0.18 65)"
  accent-text: "oklch(1.00 0 0)"
  muted: "oklch(0.50 0.02 60)"
  border: "oklch(0.88 0.01 70)"
colorsDark:
  # Dark mode (auto-applied via @media (prefers-color-scheme: dark))
  bg: "oklch(0.18 0.04 60)"
  card-bg: "oklch(0.22 0.04 60)"
  text: "oklch(0.95 0.01 80)"
  accent: "oklch(0.72 0.18 70)"
  accent-text: "oklch(0.12 0.04 60)"
  muted: "oklch(0.55 0.03 60)"
  border: "oklch(0.35 0.04 60)"
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
rounded:
  DEFAULT: 14px
  sm: 8px
---

## Brand & Style

Default design system. A calm, balanced theme with Inter typography that **respects the visitor's system color scheme** — light by default, dark when `prefers-color-scheme: dark`. Use this design system's color tokens, spacing, and typographic choices consistently across all generated components.

## Colors

The default theme defines two color sets, light (top-level `colors`) and dark (`colorsDark`). Apply them via a `@media (prefers-color-scheme: dark)` block (in a `<style>` tag, in CSS variables, or in Tailwind dark-mode classes — whichever the surrounding code uses). Never hard-code one mode only — components must read correctly in both.

### Light tokens

- **bg** (oklch(0.97 0.01 80)): Page background — warm off-white.
- **card-bg** (oklch(1.00 0 0)): Card / surface — pure white.
- **text** (oklch(0.20 0.02 60)): Primary text — near-black with warm undertone.
- **accent** (oklch(0.62 0.18 65)): Primary actions and accents — saturated golden.
- **accent-text** (oklch(1.00 0 0)): Text on accent fills — pure white.
- **muted** (oklch(0.50 0.02 60)): Secondary / muted content.
- **border** (oklch(0.88 0.01 70)): Borders and dividers — soft warm gray.

### Dark tokens

- **bg** (oklch(0.18 0.04 60)): Page background — warm dark canvas.
- **card-bg** (oklch(0.22 0.04 60)): Card / surface — slightly lifted.
- **text** (oklch(0.95 0.01 80)): Primary text — warm off-white.
- **accent** (oklch(0.72 0.18 70)): Primary actions and accents — softer golden for dark.
- **accent-text** (oklch(0.12 0.04 60)): Text on accent fills — near-black.
- **muted** (oklch(0.55 0.03 60)): Secondary / muted content.
- **border** (oklch(0.35 0.04 60)): Borders and dividers.

## Typography

Load fonts from Google Fonts: Inter. Use `display=optional`.
Primary body font: `'Inter', sans-serif`.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors in **both modes**. The accent color is the same role in both modes (golden); only its lightness shifts.

The recommended pattern for inline-styled components:

```js
// CSS variables that flip with prefers-color-scheme — set once on :root.
const themeStyle = `
  :root {
    --bg: oklch(0.97 0.01 80);
    --card-bg: oklch(1.00 0 0);
    --text: oklch(0.20 0.02 60);
    --accent: oklch(0.62 0.18 65);
    --accent-text: oklch(1.00 0 0);
    --muted: oklch(0.50 0.02 60);
    --border: oklch(0.88 0.01 70);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: oklch(0.18 0.04 60);
      --card-bg: oklch(0.22 0.04 60);
      --text: oklch(0.95 0.01 80);
      --accent: oklch(0.72 0.18 70);
      --accent-text: oklch(0.12 0.04 60);
      --muted: oklch(0.55 0.03 60);
      --border: oklch(0.35 0.04 60);
    }
  }
`;
```

Then reference `var(--bg)`, `var(--text)`, etc. in inline styles or className-driven CSS.
