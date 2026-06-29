# shift-cash-board

> End-of-shift cash reconciliation board. Each closer enters cash, card sales, tips, voids. App computes deposit total and flags discrepancy vs POS. Closers initial to sign off. Daily ledger of past shifts. useFireproof for sync. Single-file React.

Live at [https://vibes.diy/vibe/og/shift-cash-board](https://vibes.diy/vibe/og/shift-cash-board)

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
