---
name: Atelier Studio
typography:
  body-md:
    fontFamily: Playfair Display
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Atelier Studio design system. A clean, structured theme with Italianno and Playfair Display and Space Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.95 0.03 70)): Use for backgrounds.
- **comp-text** (oklch(0.25 0.04 30)): Use for text content.
- **comp-border** (oklch(0.25 0.04 30 / 0.15)): Use for borders and dividers.
- **comp-accent** (oklch(0.65 0.18 55)): Use for primary actions and accents.
- **comp-accent-text** (oklch(1.00 0 0)): Use for text content.
- **comp-muted** (oklch(0.50 0.04 30)): Use for secondary/muted content.
- **color-background** (oklch(0.96 0.03 70)): Use for backgrounds.
- **comp-accent-secondary** (oklch(0.60 0.15 40)): Use for primary actions and accents.

## Typography

Load fonts from Google Fonts: Italianno, Playfair Display, Space Mono. Use display=optional.
Primary body font: 'Playfair Display', serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
