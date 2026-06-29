# li-thought-leader-streak

> Daily LinkedIn parody habit tracker. Each day a new AI-generated cringe topic prompt appears. User writes a short parody response. Calendar heatmap (like GitHub contributions) shows their streak over time. Badges unlock at 3, 7, 14, 30 days. Past entries saved in Fireproof, browsable by date. Tone: encouraging-but-deranged motivational coach.

Live at [https://vibes.diy/vibe/jchris/li-thought-leader-streak](https://vibes.diy/vibe/jchris/li-thought-leader-streak)

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
