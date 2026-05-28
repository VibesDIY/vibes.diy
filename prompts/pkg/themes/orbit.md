---
name: Orbit Dashboard
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Orbit Dashboard design system. A clean, structured theme with Inter typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg-gradient-from** (oklch(0.56 0.29 302)): Use for backgrounds.
- **bg-gradient-to** (oklch(0.44 0.22 304)): Use for backgrounds.
- **surface** (oklch(0.00 0.000 0)): Use for supporting UI elements.
- **card** (oklch(0.18 0.000 0 / 0.8)): Use for supporting UI elements.
- **card-solid** (oklch(0.28 0.03 257)): Use for supporting UI elements.
- **border** (oklch(0.37 0.03 260)): Use for borders and dividers.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **fg-muted** (oklch(0.71 0.02 261)): Use for text content.

## Typography

Load fonts from Google Fonts: Inter. Use display=optional.
Primary body font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
