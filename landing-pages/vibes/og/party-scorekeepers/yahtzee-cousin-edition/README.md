# yahtzee-cousin-edition

> Build a single-file React Yahtzee scorekeeper called 'Yahtzee Cousin Edition' for 2-6 named players. Use useFireproof from 'use-fireproof' for live cross-device sync of the scorecard. Persist player names and house-rule choices in localStorage per browser. Render the standard 13-category scorecard (ones through sixes with upper bonus at 63, three-of-a-kind, four-of-a-kind, full house, small straight, large straight, Yahtzee, chance) as a tappable grid where you enter scores per round. Include a sidebar of toggleable house-rule overrides: joker rules on/off for bonus Yahtzees, full-house = 30 vs 25, allow five-of-a-kind bonus (extra 50), allow stacking small-straight credit on chance row. Show running totals, upper-section progress toward bonus, and final winner. Mobile-friendly tap targets, sticky header with current round.

Live at [https://vibes.diy/vibe/og/yahtzee-cousin-edition](https://vibes.diy/vibe/og/yahtzee-cousin-edition)

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
