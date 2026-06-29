# prep-list-by-section

> Build a single-file React app called Prep List by Section for a restaurant kitchen (3-15 cooks). Use Fireproof via useFireproof from 'use-fireproof' for live sync between every station's tablet and the chef's office. Stations are columns: Sauté, Grill, Garde Manger, Pastry, Pantry (configurable). Each prep item is a card with: item name (e.g. 'demi-glace, 2 qt'), owner cook (assigned), due-time (e.g. 'by 4:30pm'), done checkbox, and a 'started' timestamp. Add form per column: item, owner dropdown, due time. Doc { type:'prep', station, item, owner, dueAt, started, doneAt, note, createdAt }. Items past due that aren't done turn red. A 'Chef View' toggle at top collapses all columns into one dense list sorted by due time, so the chef can spot misses before service. Bottom shows progress per station ('Sauté: 7/9 done'). Tone: tight, professional kitchen — chalkboard backgrounds, clipboard feel, big readable type for steamy hands. Mobile-first for tablets clipped to walls.

Live at [https://vibes.diy/vibe/og/prep-list-by-section](https://vibes.diy/vibe/og/prep-list-by-section)

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
