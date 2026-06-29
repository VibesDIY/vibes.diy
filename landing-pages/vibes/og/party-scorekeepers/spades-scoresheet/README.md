# spades-scoresheet

> Build a single-file React Spades scoresheet for partner-pair (2v2) play. Use useFireproof from 'use-fireproof' for live sync so both teams see the same sheet. Persist the four named players (two teams of two) and team names to localStorage per browser. Per hand: enter each team's bid, each team's tricks taken, and any nil/blind-nil declarations. Auto-calculate score per standard rules: bid made = bid×10 + 1 per overtrick (bag), bid missed = -bid×10, nil success = +100, nil fail = -100, blind nil ±200. Apply bag penalty: every 10 bags accumulated subtracts 100 from team total. Show running totals, bag counter per team, hand-by-hand log with edit/undo. Mobile-friendly two-column layout for the two teams, big numeric inputs.

Live at [https://vibes.diy/vibe/og/spades-scoresheet](https://vibes.diy/vibe/og/spades-scoresheet)

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
