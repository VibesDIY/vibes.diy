---
name: Zine Cut
typography:
  body-md:
    fontFamily: var(--f-type)
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Zine Cut design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.96 0.005 100)): Use for backgrounds.
- **comp-text** (oklch(0.05 0 0)): Use for text content.
- **comp-border** (oklch(0.05 0 0)): Use for borders and dividers.
- **comp-accent** (oklch(0.05 0 0)): Use for primary actions and accents.
- **comp-accent-text** (oklch(0.96 0.005 100)): Use for text content.
- **comp-muted** (oklch(0.05 0 0 / 0.3)): Use for secondary/muted content.
- **zine-inverted-bg** (oklch(0.05 0 0)): Use for backgrounds.
- **zine-inverted-text** (oklch(0.96 0.005 100)): Use for text content.

## Typography

Primary body font: var(--f-type).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
