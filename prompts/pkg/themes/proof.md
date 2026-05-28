---
name: Proof Sheet
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Proof Sheet design system. A dark, atmospheric theme with Inter typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.14 0.000 0)): Use for backgrounds.
- **card** (oklch(0.16 0.000 0)): Use for supporting UI elements.
- **border** (oklch(0.28 0.03 257)): Use for borders and dividers.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **fg-muted** (oklch(0.71 0.02 261)): Use for text content.
- **fg-dim** (oklch(1.00 0.000 0 / 0.6)): Use for text content.
- **tag-bg** (oklch(1.00 0.000 0 / 0.1)): Use for backgrounds.
- **card-hi** (oklch(0.21 0.03 265)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Inter. Use display=optional.
Primary body font: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
