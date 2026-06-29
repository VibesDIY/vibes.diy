# mahjong-scoresheet

> Build a single-file React 4-player mahjong session scoresheet. Use useFireproof from 'use-fireproof' for live sync so all four seats see the same running totals. Persist seat names (East, South, West, North) and player names to localStorage per browser. Per hand: pick the winner (or 'draw'), enter the hand value in faan/han, choose how the losers settle (self-draw splits among three losers vs discard means the discarder pays full). Include a toggle for 'East doubled' rule (East wins or pays double). Auto-compute each player's net change per hand and roll into session totals across many hands. Show a hand-by-hand log with timestamps, current dealer (East rotation), prevailing wind indicator, and a session summary. Mobile-friendly four-quadrant scoreboard view.

Live at [https://vibes.diy/vibe/og/mahjong-scoresheet](https://vibes.diy/vibe/og/mahjong-scoresheet)

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
