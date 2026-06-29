# potluck-signup-board

> Build a single-file React app for a 'who's bringing what' potluck signup board. Use useFireproof from use-fireproof so the whole family can edit the same board live. Input surface: a host creates an event (title, date, location), guests add their name, the dish they're bringing, and toggle dietary chips (vegan, GF, nut-free, dairy-free). There's a 'claim a slot' affordance for missing categories: appetizer, main, side, dessert, drink. Saved doc shape: { type: 'signup', _id, event, guestName, dish, category, dietary: [], claimed, createdAt }. Visible UI: a header card with event details, four category columns (appetizer/main/dessert/drink) each showing claimed cards plus an empty 'claim this slot' button, a dietary-chip filter strip at top, and a running headcount. Tone: warm fridge-magnet hospitality, casual handwritten feel.

Live at [https://vibes.diy/vibe/og/potluck-signup-board](https://vibes.diy/vibe/og/potluck-signup-board)

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
