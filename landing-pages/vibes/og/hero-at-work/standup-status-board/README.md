# standup-status-board

> Team standup status board for small engineering teams — beat the daily Zoom by writing it up async. Each teammate fills a card with three text fields (Yesterday, Today, Blockers) plus a one-tap mood emoji at the top of their card (six choices: 🚀 🔥 😅 😬 🧠 🌧). Names are remembered via localStorage so people do not retype. The board renders as a responsive 2-3 column grid sorted most-recently-edited first; each card shows name, mood, the three fields, a relative timestamp ("posted 14 min ago"), and a small 7-day streak strip (filled-in dots for each day that teammate posted). Above the grid: a header with today’s date, a "team check-in" donut chart showing the percentage of the team that has posted today, and a "Clear board for tomorrow" button that archives the current day to history. Below the grid: a collapsed "Past standups" panel showing one row per archived day, expandable to view that day’s board read-only. Blockers field gets a red border glow when non-empty. Use Fireproof useLiveQuery for sync so the whole team sees updates live. Single-file React. Tone: fast, friendly, async-team-energy — no clutter, big readable type, the empty board prompts "first one to post sets the tone".

Live at [https://vibes.diy/vibe/jchris/standup-status-board](https://vibes.diy/vibe/jchris/standup-status-board)

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
