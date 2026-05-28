---
name: Mesh Void
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Mesh Void design system. A clean, structured theme with Inter and JetBrains Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **void** (oklch(0.07 0.000 0)): Use for supporting UI elements.
- **panel** (oklch(0.10 0.000 0)): Use for supporting UI elements.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **fg-muted** (oklch(0.49 0.000 0)): Use for text content.
- **fg-dim** (oklch(0.30 0.000 0)): Use for text content.
- **border** (oklch(1.00 0.000 0 / 0.15)): Use for borders and dividers.
- **hover** (oklch(0.13 0.000 0)): Use for supporting UI elements.
- **accent** (oklch(0.87 0.28 145)): Use for primary actions and accents.

## Typography

Load fonts from Google Fonts: Inter, JetBrains Mono. Use display=optional.
Primary body font: 'Inter', -apple-system, sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
