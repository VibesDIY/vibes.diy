# trade-desk-handoff

> End-of-day desk handoff log for trading desks. Each trader posts: open positions held overnight, pending orders, key client conversations, anything the next-shift trader must know. Each entry has a "read and acknowledged" checkbox the incoming trader checks. Filter by date or trader. useFireproof for live sync. Single-file React. Tone: serious, concise, audit-trail clean.

Live at [https://vibes.diy/vibe/og/trade-desk-handoff](https://vibes.diy/vibe/og/trade-desk-handoff)

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
