# demo-unit-pool

> Sales Demo Unit Pool — laptops/devices. 'Where is the demo?' Each device has a SKU, model name, condition, current holder. Reps can [ CHECK OUT ] (claim it for an event) and [ RETURN ] (with optional damage notes). Each event is a Fireproof doc { device, holder, ts, action, notes }. The home view: ledger of devices, status pip + holder name + last-action date. Filter by location, model, or available-only. A leaderboard of who-checks-out-most. Reminder system (visual badge) for devices held >14 days. Audit log below. STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter 1rem; mono labels in Space Mono for IDs/SKUs/dates. Background bg oklch(0.08 0.03 280) (deep purple-near-black). Cards card-bg oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12) (faint amber-tinted hairlines). Foreground text oklch(0.93 0.02 80) (warm cream). Muted oklch(0.50 0.04 290) (dim purple). Accent oklch(0.72 0.15 75) (warm amber); accent-text oklch(0.10 0.03 280) (near-bg). Secondary purple oklch(0.55 0.18 300) for special states. Sharp corners. Layout: a fixed-width inventory ledger with monospace SKU column, item name in Inter, quantities right-aligned in Space Mono. Status pips: small 8px squares (amber filled = available, dim purple = checked-out, red = missing/overdue). Buttons: amber background, near-bg text, hover deepens to purple. Inputs: transparent with amber bottom-border; quantity inputs are square 64px boxes monospace. Tone: a back-of-house ledger app, not corporate SaaS — low-light warehouse vibes. Single-file React with useFireproof; persist as inventory mutations with full audit log below.

Live at [https://vibes.diy/vibe/jchris/demo-unit-pool](https://vibes.diy/vibe/jchris/demo-unit-pool)

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
