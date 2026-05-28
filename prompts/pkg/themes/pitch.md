---
name: Pitch
typography:
  body-md:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Pitch design system. A dark, atmospheric theme with Space Grotesk and Space Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.22 0.05 163)): Use for backgrounds.
- **card-bg** (oklch(0.27 0.055 163)): Use for backgrounds.
- **text** (oklch(0.95 0.01 100)): Use for text content.
- **border** (oklch(0.39 0.065 165)): Use for borders and dividers.
- **accent** (oklch(0.86 0.18 90)): Use for primary actions and accents.
- **accent-text** (oklch(0.20 0.04 163)): Use for text content.
- **muted** (oklch(0.55 0.04 165)): Use for secondary/muted content.

## Typography

Load fonts from Google Fonts: Space Grotesk, Space Mono. Use display=optional.
Primary body font: 'Space Grotesk', sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
