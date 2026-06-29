# li-fake-post-card

> Fake LinkedIn post card generator. Generate parody posts as visual cards that mimic LinkedIn UI: author avatar circle with initials, parody name, parody title, body text, reaction strip (thumbs up + heart + handshake icons with counts), comment count. AI fills in all fields from a single user prompt. Card styled close to real LinkedIn aesthetic (Inter font, blue accent, rounded corners, subtle shadow). Save as Fireproof, list past cards.

Live at [https://vibes.diy/vibe/jchris/li-fake-post-card](https://vibes.diy/vibe/jchris/li-fake-post-card)

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
