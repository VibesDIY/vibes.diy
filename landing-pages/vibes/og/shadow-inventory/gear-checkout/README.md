# gear-checkout

> Gear Checkout Ledger. Each item: serial number, version, current holder, status (RACK / OUT / FIELD / RETIRED). Users check items out with a project tag and ETA; return with a state-update note. Each event saved as a Fireproof doc. Home view: a strict ledger table sorted by serial. Click an item to see its full lineage. Filter ledger by status. Style: dark purple-near-black background, warm amber accent, Inter body + Space Mono for serials, sharp corners, single-file React with useFireproof.

Live at [https://vibes.diy/vibe/jchris/gear-checkout](https://vibes.diy/vibe/jchris/gear-checkout)

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
