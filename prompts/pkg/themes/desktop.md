---
name: Desktop Retro
typography:
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Desktop Retro design system. A clean, structured theme with JetBrains Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **editor-bg** (oklch(0.11 0.01 250)): Use for backgrounds.
- **chrome** (oklch(0.18 0.000 0)): Use for supporting UI elements.
- **gutter** (oklch(0.39 0.01 250)): Use for supporting UI elements.
- **code-text** (oklch(0.75 0.02 240)): Use for text content.
- **code-comment** (oklch(0.59 0.000 0)): Use for supporting UI elements.
- **syn-keyword** (oklch(0.62 0.14 55)): Use for supporting UI elements.
- **syn-string** (oklch(0.57 0.08 140)): Use for supporting UI elements.
- **syn-prop** (oklch(0.56 0.08 300)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: JetBrains Mono. Use display=optional.
Primary body font: 'JetBrains Mono', monospace.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.
