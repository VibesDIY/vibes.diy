# li-bingo-board

> LinkedIn cringe bingo board. Render a 5x5 bingo card pre-filled with 25 famous LinkedIn cringe phrases such as "Day 1 of...", "Not gonna lie", "Game-changer", "CEO of...", "Buckle up", "🧵 1/", "Hot take", "Unpopular opinion", "Quick reminder", "Folks", "Hire her", "Humbled to announce", "Big news", "I almost cried", "Excited to share", "Onwards and upwards" — pick a good list of 25. User pastes a real LinkedIn post into a textarea. App scans the text and highlights any matching squares (case-insensitive substring match). When any row, column, or diagonal lights up, show a "BINGO!" celebration banner. Save scanned posts as Fireproof docs with hit count. List past posts with their score. No AI calls needed — just string matching. Cringe-corporate parody tone for all UI copy.

Live at [https://vibes.diy/vibe/jchris/li-bingo-board](https://vibes.diy/vibe/jchris/li-bingo-board)

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
