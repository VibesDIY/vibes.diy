# merge-fruit-stack

> Suika-style merge: drop circles from the top; same-sized circles merge into the next bigger size on collision. Box has a max height; reaching the top ends the run. Score = merge chain. Save scores to Fireproof; high score table.

Live at [https://vibes.diy/vibe/og/merge-fruit-stack](https://vibes.diy/vibe/og/merge-fruit-stack)

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
