# swag-closet

> Marketing Swag Closet — t-shirts, stickers, tumblers, nobody owns it. Add items with SKU, name, size variants (S/M/L/XL), color, current count. Track checkouts: who took how many and when (for a trade show, a customer gift, etc). Each checkout is a Fireproof doc. Low-stock items (count < threshold) auto-flag amber. The home ledger shows all items in a strict table sorted by SKU; click any row to expand to its checkout history. A request box for items not yet stocked. Audit log below shows every mutation. STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter 1rem; mono labels in Space Mono for IDs/SKUs/dates. Background bg oklch(0.08 0.03 280) (deep purple-near-black). Cards card-bg oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12) (faint amber-tinted hairlines). Foreground text oklch(0.93 0.02 80) (warm cream). Muted oklch(0.50 0.04 290) (dim purple). Accent oklch(0.72 0.15 75) (warm amber); accent-text oklch(0.10 0.03 280) (near-bg). Secondary purple oklch(0.55 0.18 300) for special states. Sharp corners. Layout: a fixed-width inventory ledger with monospace SKU column, item name in Inter, quantities right-aligned in Space Mono. Status pips: small 8px squares (amber filled = available, dim purple = checked-out, red = missing/overdue). Buttons: amber background, near-bg text, hover deepens to purple. Inputs: transparent with amber bottom-border; quantity inputs are square 64px boxes monospace. Tone: a back-of-house ledger app, not corporate SaaS — low-light warehouse vibes. Single-file React with useFireproof; persist as inventory mutations with full audit log below.

Live at [https://vibes.diy/vibe/jchris/swag-closet](https://vibes.diy/vibe/jchris/swag-closet)

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
