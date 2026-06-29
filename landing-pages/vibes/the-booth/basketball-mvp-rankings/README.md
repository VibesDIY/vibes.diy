# basketball-mvp-rankings

> Theme: ---
name: Broadsheet
typography:
  body-md:
    fontFamily: Helvetica Neue
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Broadsheet design system. A clean, structured theme with system typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Typography

Primary body font: 'Helvetica Neue', Helvetica, Arial, sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

A weekly basketball MVP power ranking. Add players, cast votes each week, and see a ranked chart with bars showing vote totals. Track how the ranking shifts week over week.

Live at [https://vibes.diy/vibe/og/basketball-mvp-rankings](https://vibes.diy/vibe/og/basketball-mvp-rankings)

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
