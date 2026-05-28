---
name: Capsule Split
typography:
  body-md:
    fontFamily: var(--font-main)
    fontSize: 1rem
    fontWeight: "400"
rounded:
  outer: 32px
  inner: 24px
  pill: 100px
---

## Brand & Style

Capsule Split design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.89 0.20 110)): Use for backgrounds.
- **comp-text** (oklch(0.00 0 0)): Use for text content.
- **comp-border** (oklch(0.00 0 0 / 0.10)): Use for borders and dividers.
- **comp-accent** (oklch(0.00 0 0)): Use for primary actions and accents.
- **comp-accent-text** (oklch(1.00 0 0)): Use for text content.
- **comp-muted** (oklch(0.00 0 0 / 0.50)): Use for secondary/muted content.
- **color-background** (oklch(0.00 0 0)): Use for backgrounds.
- **capsule-frame** (oklch(1.00 0 0)): Use for supporting UI elements.

## Typography

Primary body font: var(--font-main).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
