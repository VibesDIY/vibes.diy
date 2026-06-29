# basketball-slang-glossary

> Theme: ---
name: Atlas Reference
typography:
  body-md:
    fontFamily: var(--font-sans)
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Atlas Reference design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(1.00 0 0)): Use for backgrounds.
- **comp-text** (oklch(0.13 0 0)): Use for text content.
- **comp-border** (oklch(0.93 0 0)): Use for borders and dividers.
- **comp-accent** (oklch(0.62 0.24 25)): Use for primary actions and accents.
- **comp-accent-text** (oklch(0.13 0 0)): Use for text content.
- **comp-muted** (oklch(0.66 0 0)): Use for secondary/muted content.
- **color-background** (oklch(1.00 0 0)): Use for backgrounds.
- **atlas-brand-bg** (oklch(0.62 0.24 25)): Use for backgrounds.

## Typography

Primary body font: var(--font-sans).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

A shared glossary for a basketball crew's invented slang and play names. Add a term, a definition, and an example. Search and filter alphabetically. Upvote the best entries.

Live at [https://vibes.diy/vibe/og/basketball-slang-glossary](https://vibes.diy/vibe/og/basketball-slang-glossary)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
