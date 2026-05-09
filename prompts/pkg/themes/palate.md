---
name: Palate Notes
colors:
  bg: "oklch(0.17 0.000 0)"
  fg: "oklch(0.93 0.006 265)"
  fg-muted: "oklch(0.71 0.02 261)"
  border: "oklch(0.37 0.03 260)"
  dot: "oklch(0.93 0.006 265)"
typography:
  body-md:
    fontFamily: Cormorant Garamond
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Palate Notes design system. A dark, atmospheric theme with Cormorant Garamond typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.17 0.000 0)): Use for backgrounds.
- **fg** (oklch(0.93 0.006 265)): Use for text content.
- **fg-muted** (oklch(0.71 0.02 261)): Use for text content.
- **border** (oklch(0.37 0.03 260)): Use for borders and dividers.
- **dot** (oklch(0.93 0.006 265)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Cormorant Garamond. Use display=optional.
Primary body font: 'Cormorant Garamond', serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
