# li-headline-ranker

> Cringe headline ranker. User enters a topic. AI produces 10 absurd LinkedIn-influencer headlines ranked by simulated viral potential (a number from 0 to 100). Render as a podium for top 3 and a bar chart for the remaining 7. Save each ranking session as a Fireproof doc with the topic. Browse past sessions. Tone: parody "headline lab" with playful ranking labels (FIRE / MID / FLOPS).

Live at [https://vibes.diy/vibe/jchris/li-headline-ranker](https://vibes.diy/vibe/jchris/li-headline-ranker)

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
