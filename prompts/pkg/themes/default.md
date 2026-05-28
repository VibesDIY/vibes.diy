---
name: Default
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
rounded:
  DEFAULT: 14px
  sm: 8px
---

## Brand & Style

Default design system. A calm, balanced theme with Inter typography that **respects the visitor's system color scheme** — light by default, dark when `prefers-color-scheme: dark`. Use this design system's color tokens, spacing, and typographic choices consistently across all generated components.

## Colors

The default theme defines two color sets, light (top-level `colors`) and dark (`colorsDark`). Apply them via a `@media (prefers-color-scheme: dark)` block (in a `<style>` tag, in CSS variables, or in Tailwind dark-mode classes — whichever the surrounding code uses). Never hard-code one mode only — components must read correctly in both.

### Light tokens

- **bg** (`{{bg}}`): Page background — warm off-white.
- **card-bg** (`{{card-bg}}`): Card / surface — pure white.
- **text** (`{{text}}`): Primary text — near-black with warm undertone.
- **accent** (`{{accent}}`): Primary actions and accents — saturated golden.
- **accent-text** (`{{accent-text}}`): Text on accent fills — pure white.
- **muted** (`{{muted}}`): Secondary / muted content.
- **border** (`{{border}}`): Borders and dividers — soft warm gray.

### Dark tokens

Read the dark-mode values from the `colorsDark` block in the frontmatter and wire them inside a `@media (prefers-color-scheme: dark)` rule. Each light token has a corresponding dark counterpart with the same role; only the value shifts.

## Typography

Load fonts from Google Fonts: Inter. Use `display=optional`.
Primary body font: `'Inter', sans-serif`.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors in **both modes**. The accent color is the same role in both modes; only its lightness/value shifts.

The recommended pattern for inline-styled components: emit a `<style>` block (or CSS-in-JS) that defines CSS custom properties for every token in `colors` on `:root`, then mirrors the `colorsDark` values inside `@media (prefers-color-scheme: dark) { :root { ... } }`. Reference the tokens as `var(--bg)`, `var(--text)`, etc. in your component styles. Drive the actual values from the frontmatter — never inline literal hex/oklch in component code.
