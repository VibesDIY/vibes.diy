# order-10k

> Theme: ---
name: Proof Sheet
typography:
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: "400"
---

## Brand & Style

Proof Sheet design system. A dark, atmospheric theme with Inter typography. Use this design system\'s color tokens, spacing, and typographic choices consistently across all generated components. This theme **respects the visitor's system color scheme** — dark by default, with a light variant that auto-applies on `@media (prefers-color-scheme: light)`. Apply both color sets via CSS variables in a `<style>` block; never hard-code one mode only.

## Colors

- **bg** (oklch(0.14 0.000 0)): Use for backgrounds.
- **card** (oklch(0.16 0.000 0)): Use for supporting UI elements.
- **border** (oklch(0.28 0.03 257)): Use for borders and dividers.
- **fg** (oklch(1.00 0.000 0)): Use for text content.
- **fg-muted** (oklch(0.71 0.02 261)): Use for text content.
- **fg-dim** (oklch(1.00 0.000 0 / 0.6)): Use for text content.
- **tag-bg** (oklch(1.00 0.000 0 / 0.1)): Use for backgrounds.
- **card-hi** (oklch(0.21 0.03 265)): Use for supporting UI elements.

## Typography

Load fonts from Google Fonts: Inter. Use display=optional.
Primary body font: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif.

## Components

Apply the color tokens and typography consistently to all interactive elements (buttons, inputs, cards, modals). Ensure sufficient contrast between text and background colors for accessibility.

The 10-K of your fast food order. Paste items or upload a receipt photo. App parodies an SEC annual report: revenue (spend), COGS (calories), MD&A (one paragraph of dry commentary on this order), risk factors (ice cream machine, mid-shift swap, fries freshness), forward outlook. Save filings in Fireproof. Each filing gets a shareable card.

Live at [https://vibes.diy/vibe/og/order-10k](https://vibes.diy/vibe/og/order-10k)

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
