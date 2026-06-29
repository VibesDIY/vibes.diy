# icp-prospect-tracker

> Pipeline tracker for a small B2B sales team — a focused ICP (ideal customer profile) sheet that beats living in spreadsheets. Quick-add form at the top: company name, contact name, stage picker (Lead → Qualified → Demo → Closed-Won → Closed-Lost), fit score (1-5 stars, click to set), deal value in dollars (number input, optional), last-touch date (date picker defaulting to today). Below the form, a horizontal funnel bar visualizing how many prospects sit in each stage, color-coded — bigger bars for fuller stages — with the conversion percentage between adjacent stages overlaid. Below the funnel, the prospect list as a sortable table with chip filters at the top (toggle stages on/off, sort dropdown for "Fit score", "Staleness — oldest last-touch first", "Deal value", "Company A-Z"). Each row shows all fields plus a "Touched today" button that resets last-touch to now and a "Next step" smart suggestion ("Send a check-in" if stale > 14 days, "Schedule demo" if Qualified > 7 days, "Close it!" if Demo > 5 days). Stale prospects get a subtle red dot. Footer summary tiles: total pipeline value, deals closed-won this month, average fit score. Fireproof useLiveQuery for sync. Tone: clean B2B internal tool, no fluff, sortable-table-with-superpowers. Single-file React.

Live at [https://vibes.diy/vibe/jchris/icp-prospect-tracker](https://vibes.diy/vibe/jchris/icp-prospect-tracker)

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
