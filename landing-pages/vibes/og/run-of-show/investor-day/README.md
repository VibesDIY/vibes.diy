# investor-day

> Investor Day Rundown — an 8-hour live-event rundown with executive rotations. Pre-load: the event has named segments (KEYNOTE, PRODUCT BLOCK, FINANCIALS, OPS BLOCK, FIRESIDE, CLOSING) each with a primary speaker, a back-up, expected start, expected duration, and a stage location. Each segment is a Fireproof doc. Live view: a 3-column board EXECS / SEGMENTS / STAGES with the live NOW line crossing all three. Segments occupy time blocks; their owner-exec is highlighted as ON STAGE on the executives column for the segment\'s duration. A handoff pane shows the next two transitions (who hands off to whom, in which room). Drift counter at top. A side action log captures any chief-of-staff intervention (e.g. moved Q

Live at [https://vibes.diy/vibe/theme/investor-day](https://vibes.diy/vibe/theme/investor-day)

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
