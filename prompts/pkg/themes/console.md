---
name: Console Rack
typography:
  body-md:
    fontFamily: var(--font-ui)
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Console Rack design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.93 0.003 265)): Use for backgrounds.
- **comp-text** (oklch(0.28 0 0)): Use for text content.
- **comp-border** (oklch(0.82 0.005 265)): Use for borders and dividers.
- **comp-accent** (oklch(0.58 0.20 35)): Use for primary actions and accents.
- **comp-accent-text** (oklch(1.00 0 0)): Use for text content.
- **comp-muted** (oklch(0.55 0 0)): Use for secondary/muted content.
- **color-background** (oklch(0.98 0 0)): Use for backgrounds.
- **console-cap-blue** (oklch(0.28 0.05 240)): Use for supporting UI elements.

## Typography

Primary body font: var(--font-ui).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
