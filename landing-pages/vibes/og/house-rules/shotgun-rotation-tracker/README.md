# shotgun-rotation-tracker

> Build a single-file React app for tracking who called shotgun on each leg of a road trip. Use useFireproof from use-fireproof so all passengers' phones see the same rotation. Input surface: add the trip roster (names), then per leg tap who's in the front seat; the app keeps a tally of front-seat legs per person and auto-suggests who is owed shotgun next. Saved doc shape: { type: 'trip', _id, name, roster: [], legs: [{from, to, shotgun, timestamp}], createdAt }. Visible UI: trip header, big 'next leg' card showing the auto-suggested person with a 'they accept' / 'override' button, a leg-by-leg history list, and a tally board ranking each rider by total shotgun legs taken vs owed. Tone: sun-bleached dashboard fairness, friendly diner-coffee road-trip energy.

Live at [https://vibes.diy/vibe/og/shotgun-rotation-tracker](https://vibes.diy/vibe/og/shotgun-rotation-tracker)

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
