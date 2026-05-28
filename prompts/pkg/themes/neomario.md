---
name: NeoMario
typography:
  body-md:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: "400"
rounded:
  DEFAULT: 4px
---

## Brand & Style

NeoMario design system. A clean, structured theme with Space Grotesk and JetBrains Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.96 0.01 90)): Use for backgrounds.
- **card-bg** (oklch(1.00 0 0)): Use for backgrounds.
- **text** (oklch(0.15 0.02 280)): Use for text content.
- **border** (oklch(0.15 0.02 280)): Use for borders and dividers.
- **accent** (oklch(0.55 0.24 28)): Use for primary actions and accents.
- **accent-light** (oklch(0.55 0.24 28 / 0.1)): Use for primary actions and accents.
- **muted** (oklch(0.50 0.02 280)): Use for secondary/muted content.
- **yellow** (oklch(0.85 0.18 85)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Space Grotesk, JetBrains Mono. Use display=optional.
Primary body font: 'Space Grotesk', sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
