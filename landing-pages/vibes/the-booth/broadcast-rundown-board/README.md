# broadcast-rundown-board

> Theme: ---
name: Dossier Card
typography:
  body-md:
    fontFamily: Roboto Mono
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Dossier Card design system. A dark, atmospheric theme with Archivo Black and Roboto Mono typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.16 0.000 0)): Use for backgrounds.
- **card** (oklch(0.00 0.000 0)): Use for supporting UI elements.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **border** (oklch(0.28 0.03 257)): Use for borders and dividers.
- **border-fg** (oklch(1.00 0.000 0)): Use for text content.

## Typography

Load fonts from Google Fonts: Archivo Black, Roboto Mono. Use display=optional.
Primary body font: 'Roboto Mono', monospace.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

A run-of-show board for a basketball broadcast crew. List segments in order with a time, the host on the mic, and the topic. Reorder segments, check them off as they air, and total the runtime.

Live at [https://vibes.diy/vibe/og/broadcast-rundown-board](https://vibes.diy/vibe/og/broadcast-rundown-board)

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
