# pet-feed-tracker

> Pet feeding log for households with multiple caretakers. Add pets (name, food type, portion). Tap a big button to log a feeding — records who fed, time, portion. Show today's feedings as a timeline; warn if a pet hasn't been fed in 8+ hours. Use Fireproof useLiveQuery so multiple devices stay in sync. No images.

Live at [https://vibes.diy/vibe/jchris/pet-feed-tracker](https://vibes.diy/vibe/jchris/pet-feed-tracker)

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
