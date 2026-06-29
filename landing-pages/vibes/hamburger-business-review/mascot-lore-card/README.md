# mascot-lore-card

> Theme: ---
name: Vault
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Vault design system. A dark, atmospheric theme with Space Mono and Inter typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.08 0.03 280)): Use for backgrounds.
- **card-bg** (oklch(0.12 0.03 280 / 0.7)): Use for backgrounds.
- **text** (oklch(0.93 0.02 80)): Use for text content.
- **border** (oklch(0.65 0.15 80 / 0.12)): Use for borders and dividers.
- **accent** (oklch(0.72 0.15 75)): Use for primary actions and accents.
- **accent-text** (oklch(0.10 0.03 280)): Use for text content.
- **muted** (oklch(0.50 0.04 290)): Use for secondary/muted content.
- **purple** (oklch(0.55 0.18 300)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Space Mono, Inter. Use display=optional.
Primary body font: 'Inter', sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

Mascot lore card generator. Pick a fast-food mascot (Ronald, the King, the Colonel, Jack, the Noid, Wendy). Generate an archival 'lore card' with era, status, controversies, key episodes, and a one-line elegy. Vault aesthetic — dark amber, archival. Save card collection in Fireproof.

Live at [https://vibes.diy/vibe/og/mascot-lore-card](https://vibes.diy/vibe/og/mascot-lore-card)

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
