# live-basketball-scoreboard

> Theme: ---
name: Console Rack
typography:
  body-md:
    fontFamily: var(--font-ui)
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Console Rack design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **comp-bg** (oklch(0.93 0.003 265)): Use for backgrounds.
- **comp-text** (oklch(0.28 0 0)): Use for text content.
- **comp-border** (oklch(0.82 0.005 265)): Use for borders and dividers.
- **comp-accent** (oklch(0.58 0.20 35)): Use for primary actions and accents.
- **comp-accent-text** (oklch(1.00 0 0)): Use for text content.
- **comp-muted** (oklch(0.55 0 0)): Use for secondary/muted content.
- **color-background** (oklch(0.98 0 0)): Use for backgrounds.
- **console-cap-blue** (oklch(0.28 0.05 240)): Use for supporting UI elements.

## Typography

Primary body font: var(--font-ui).

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

A live basketball scoreboard the whole crew updates from their phones. Two teams, tap +1/+2/+3 to score, foul counts, a quarter selector, and a game clock you can start, stop, and reset. Editable team names. Big readable digits.

Live at [https://vibes.diy/vibe/og/live-basketball-scoreboard](https://vibes.diy/vibe/og/live-basketball-scoreboard)

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
