# every-store-in

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

Every-store-in-city completionist tracker. Pick a chain and a city; the app shows every location and lets you check them off with a timestamped visit and a photo. Newspaper-broadsheet aesthetic. Personal completion percentage, leaderboard among friends. Save visits in Fireproof.

Live at [https://vibes.diy/vibe/og/every-store-in](https://vibes.diy/vibe/og/every-store-in)

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
