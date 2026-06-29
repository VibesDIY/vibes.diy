# burger-partner

> Theme: ---
name: Hearth Sim
typography:
  body-md:
    fontFamily: Nunito
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Hearth Sim design system. A clean, structured theme with Fredoka and Nunito typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — light by default, with a dark variant that auto-applies on `@media (prefers-color-scheme: dark)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg-start** (oklch(0.18 0.10 300)): Use for backgrounds.
- **bg-end** (oklch(0.12 0.09 300)): Use for backgrounds.
- **primary** (oklch(0.38 0.17 295)): Use for primary actions and accents.
- **primary-dark** (oklch(0.30 0.15 295)): Use for primary actions and accents.
- **primary-light** (oklch(0.47 0.18 295)): Use for primary actions and accents.
- **accent-green** (oklch(0.70 0.15 155)): Use for primary actions and accents.
- **accent-gold** (oklch(0.88 0.18 95)): Use for primary actions and accents.
- **danger** (oklch(0.55 0.20 25)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Fredoka, Nunito. Use display=optional.
Primary body font: 'Nunito', sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

Burger Partner compatibility scorer. Two people enter their standing fast-food orders; the app rates compatibility (overlap on chains, sauce agreement, price gap, calorie gap, breakfast/lunch alignment) and writes a one-paragraph relationship verdict. Save couple profiles in Fireproof. Output a shareable card.

Live at [https://vibes.diy/vibe/og/burger-partner](https://vibes.diy/vibe/og/burger-partner)

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
