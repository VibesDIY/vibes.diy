# tool-request-queue

> Internal tool request queue — coworkers submit "I wish we had X" requests, and the team votes them up. Header tagline: "Beats waiting for IT." Quick-add form: title (one line), description (textarea, optional), requester name (saved in localStorage so people do not retype), urgency chip picker (Nice to have / Needed / Blocking, color-coded). Below the form: a filter row toggling status (Open / In Progress / Shipped) and a search field. The list renders as cards sorted by votes descending, each showing title, description, requester, urgency badge, vote count, and status badge. A thumbs-up button casts one vote per browser (tracked via localStorage). When a request hits 5 votes a small "trending 🔥" badge appears; at 10 votes the card briefly celebrates with a confetti emoji burst. Anyone can press "I am building this" to mark a request In Progress (yellow highlight + the builder is recorded), or "Mark shipped" with a link field that becomes a clickable URL on the card. Shipped cards can earn a "speed-run ⚡" badge if they shipped within 7 days of being filed. At the bottom, a "Hall of fame" section shows the most recent 5 shipped requests as a small read-only changelog with builder credits. Use Fireproof useLiveQuery for sync. Tone: tongue-in-cheek but functional — real lightweight kanban energy, the tool a coworker would actually open daily. Single-file React.

Live at [https://vibes.diy/vibe/jchris/tool-request-queue](https://vibes.diy/vibe/jchris/tool-request-queue)

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
