# farkle-scorekeeper

> Build a single-file React app for tracking Farkle dice game scores across rounds with house-rule variants. Use useFireproof from use-fireproof to sync games across devices. Input surface: a setup screen to add 2-6 player names, plus a settings panel with toggles for house rules (count 3 pairs as 1500, count straight 1-6 as 2500, lose-it-all on rolling zero, must-open-with-500). Saved doc shape: { type: 'game', _id, players: [{name, total, rounds: [{score, locked}]}], rules: {threePairs, straight, loseAll, mustOpen}, currentTurn, createdAt }. Visible UI: a scoreboard table with one column per player and a row per round, a big number-pad input for entering this turn's score, a 'Lock In' button per active player to commit the score, a running-total footer, and a winner banner when someone hits 10000. Tone: warm kitchen-table grandma energy, playful but legible at arm's length, large numbers.

Live at [https://vibes.diy/vibe/og/farkle-scorekeeper](https://vibes.diy/vibe/og/farkle-scorekeeper)

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
