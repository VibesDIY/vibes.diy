# li-network-grader

> Connection network analyzer parody. Paste 5-10 LinkedIn connections (name + title each line). AI grades the network and produces: 1) overall vibe score (0-100) with a gauge visualization, 2) a pie chart breakdown of connection categories ("buzzword bros", "actual humans", "MLM recruiters", "ghost profiles"), 3) a roast paragraph. Save and list past analyses.

Live at [https://vibes.diy/vibe/jchris/li-network-grader](https://vibes.diy/vibe/jchris/li-network-grader)

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
