# closing-sign-off-checklist

> Build a single-file React app called Closing Sign-Off Checklist for storefronts, dental clinics, and Pilates studios — multi-person end-of-day close-out. Use Fireproof via useFireproof from 'use-fireproof' so manager and staff share the same closing list live. Settings panel lets the manager configure stations once: Lights, Safe, Alarm, Inventory, Trash, Back Door, Restrooms, etc. (free-add). Each closing day spawns a fresh checklist of those stations as rows. Each row: station name, responsible person dropdown, a check button, and an 'initials' input that must be filled to confirm. Saves doc { type:'signoff', date, station, by, initials, checkedAt }. The 'Lock Up' status indicator at the top is red until every station has both checked AND initialed, then turns green with a timestamp. A small history log shows last 14 nights' close-outs with who signed each station. Tone: serious, accountable, slightly clipboard — ivory paper, monospace headings, navy accents, no flourish. Mobile-first; meant to be tapped through quickly at end of night.

Live at [https://vibes.diy/vibe/og/closing-sign-off-checklist](https://vibes.diy/vibe/og/closing-sign-off-checklist)

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
