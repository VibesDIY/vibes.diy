# sample-ledger

> Sample Ledger. A custody tracker. Each entry has unique ID, kind label (one of K1, K2, K3, K4), date logged, current keeper, current location. Every transfer writes a Fireproof doc with entryId, from, to, ts, notes. Home view: ledger table sorted by ID. Click an entry to see its full transfer chain rendered chronologically. Flag entries with no recent transfer in the last week. STYLE — Vault. Load Google Fonts: Space Mono, Inter (display=optional). Body Inter; mono labels in Space Mono. Background oklch(0.08 0.03 280) deep purple-near-black. Cards oklch(0.12 0.03 280 / 0.7) with backdrop-blur. Borders oklch(0.65 0.15 80 / 0.12). Foreground oklch(0.93 0.02 80). Muted oklch(0.50 0.04 290). Accent oklch(0.72 0.15 75) warm amber. Sharp corners. Status pips: 8px squares. Buttons amber bg + dark text. Single-file React with useFireproof.

Live at [https://vibes.diy/vibe/jchris/sample-ledger](https://vibes.diy/vibe/jchris/sample-ledger)

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
