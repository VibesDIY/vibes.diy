# leftover-claim-board

> Build a single-file React app called Leftover Claim Board for the end of a potluck or dinner party. Use Fireproof via useFireproof from 'use-fireproof' for live realtime sync — host posts, guests claim, everyone sees instantly. Host form at top: dish name, approximate size/portions ('half a tray', 'about 3 cups'), and 'post leftover' button. Saves doc { type:'leftover', dish, size, claims:[{name, portion}], thumbsUp:[names], resolved:false, createdAt }. Each leftover renders as a card with dish name, size, a thumbs-up button (toggle your name in thumbsUp), a 'Claim a portion' inline form (name + how much), and a list of current claimants. Host can mark resolved which greys it out. Bright friendly palette, casual tone — copy like 'who wants the rest of the pasta?'. Single screen, mobile-first, no login, just type your name each time.

Live at [https://vibes.diy/vibe/og/leftover-claim-board](https://vibes.diy/vibe/og/leftover-claim-board)

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
