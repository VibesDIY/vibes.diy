---
name: Dossier Card
typography:
  body-md:
    fontFamily: Roboto Mono
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Dossier Card design system. A dark, atmospheric theme with Archivo Black and Roboto Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.16 0.000 0)): Use for backgrounds.
- **card** (oklch(0.00 0.000 0)): Use for supporting UI elements.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **border** (oklch(0.28 0.03 257)): Use for borders and dividers.
- **border-fg** (oklch(1.00 0.000 0)): Use for text content.

## Typography

Load fonts from Google Fonts: Archivo Black, Roboto Mono. Use display=optional.
Primary body font: 'Roboto Mono', monospace.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
