---
name: Dial Apparatus
typography:
  body-md:
    fontFamily: var(--font-ui)
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Dial Apparatus design system. A dark, atmospheric theme with Share Tech Mono and Inter typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.24 0.01 260)): Use for backgrounds.
- **comp-text** (oklch(0.64 0.02 250)): Use for text content.
- **comp-border** (oklch(0.19 0.01 260 / 0.5)): Use for borders and dividers.
- **comp-accent** (oklch(0.62 0.24 28)): Use for primary actions and accents.
- **comp-accent-text** (oklch(0.10 0 0)): Use for text content.
- **comp-muted** (oklch(0.64 0.02 250 / 0.5)): Use for secondary/muted content.
- **color-background** (oklch(0.00 0 0)): Use for backgrounds.
- **dial-chassis** (oklch(0.24 0.01 260)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Share Tech Mono, Inter. Use display=optional.
Primary body font: var(--font-ui).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
