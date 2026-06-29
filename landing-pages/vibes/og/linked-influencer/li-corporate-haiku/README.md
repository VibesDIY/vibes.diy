# li-corporate-haiku

> Corporate-to-haiku translator. Paste a bloated LinkedIn post, get back a short haiku that strips the buzzwords and exposes the actual message. Use AI to do the reduction. The haiku should be sincere, not parody. Show before/after side by side with a word-count diff (e.g., "247 words → 17 syllables"). Save as Fireproof docs and list past reductions. Minimalist zen UI, lots of whitespace.

Live at [https://vibes.diy/vibe/jchris/li-corporate-haiku](https://vibes.diy/vibe/jchris/li-corporate-haiku)

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
