# from-the-machine

> Theme: ---
name: Terminal CRT
typography:
  body-md:
    fontFamily: VT323
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Terminal CRT design system. A dark, atmospheric theme with VT323 typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.16 0.000 0)): Use for backgrounds.
- **terminal** (oklch(0.00 0.000 0 / 0.85)): Use for supporting UI elements.
- **green** (oklch(0.87 0.30 142)): Use for supporting UI elements.
- **green-dim** (oklch(0.87 0.30 142 / 0.4)): Use for secondary/muted content.
- **green-border** (oklch(0.87 0.30 142 / 0.3)): Use for borders and dividers.
- **green-faint** (oklch(0.87 0.30 142 / 0.1)): Use for supporting UI elements.
- **white** (oklch(1.00 0.000 0)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: VT323. Use display=optional.
Primary body font: 'VT323', monospace.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

Kiosk-versus-human order ledger. Every fast food visit, log whether you ordered from a kiosk, the app, the drive-thru speaker, or a cashier. App tallies your automation ratio over time and projects when 'human cashier' will be a rare encounter. Terminal CRT aesthetic. Save log in Fireproof.

Live at [https://vibes.diy/vibe/og/from-the-machine](https://vibes.diy/vibe/og/from-the-machine)

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
