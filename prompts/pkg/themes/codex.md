---
name: Elder Codex
typography:
  body-md:
    fontFamily: Cinzel
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Elder Codex design system. A dark, atmospheric theme with Cinzel Decorative and Cinzel typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.06 0.000 0)): Use for backgrounds.
- **stone-dark** (oklch(0.17 0.000 0)): Use for supporting UI elements.
- **stone-light** (oklch(0.30 0.000 0)): Use for supporting UI elements.
- **stone-border** (oklch(0.40 0.000 0)): Use for borders and dividers.
- **fg** (oklch(0.90 0.000 0)): Use for text content.
- **fg-muted** (oklch(0.55 0.000 0)): Use for text content.
- **gold-base** (oklch(0.73 0.10 78)): Use for supporting UI elements.
- **gold-highlight** (oklch(0.97 0.07 100)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Cinzel Decorative, Cinzel. Use display=optional.
Primary body font: 'Cinzel', serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
