# farkle-house-rules

> Build a single-file React Farkle scorekeeper for up to 6 named players, target 10000 points. Use useFireproof from the imported 'use-fireproof' hook for live multi-device sync of game state, rounds, and scores. Persist the active player roster and house-rule toggle preferences to localStorage so the same browser remembers its crew between sessions. Add toggleable house-rule variants that affect scoring math: count three pairs as 1500, count straight (1-2-3-4-5-6) as 1500, four-of-a-kind multiplier ×2 instead of ×4, optional 'lose everything if you score zero on a turn' rule, optional 'must enter at 500' rule. Each turn: track current-turn running tally as the player accumulates rolls before lock-in, with a big visible 'Bank' button and a 'Hot Dice' indicator that lights up when all six dice score. Round-by-round entry log with undo. Mobile-friendly chunky buttons, large numerals. No external libraries beyond React and use-fireproof.

Live at [https://vibes.diy/vibe/og/farkle-house-rules](https://vibes.diy/vibe/og/farkle-house-rules)

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
