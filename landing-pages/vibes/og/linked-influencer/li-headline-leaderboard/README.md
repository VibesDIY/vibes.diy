# li-headline-leaderboard

> LinkedIn headline A/B tester. User types a topic into a textarea. App uses AI to generate exactly 10 LinkedIn-style parody headlines about that topic, each with a simulated engagement score from 0 to 99. Display them as a ranked leaderboard with horizontal bar chart visualization (longer bars = higher scores). #1 gets a confetti emoji burst. Save the topic + ranked list as a Fireproof doc. List past leaderboards in a sidebar with click-to-view. Cringe-corporate parody tone for headlines.

Live at [https://vibes.diy/vibe/jchris/li-headline-leaderboard](https://vibes.diy/vibe/jchris/li-headline-leaderboard)

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
