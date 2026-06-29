# li-thread-stretcher

> LinkedIn thread stretcher. User types a single sentence thought. App uses AI to expand it into a 10-part numbered LinkedIn thread with parody motivational filler, each part starting with an emoji. Saves thread as a Fireproof doc, lists past threads, click to view full thread.

Live at [https://vibes.diy/vibe/jchris/li-thread-stretcher](https://vibes.diy/vibe/jchris/li-thread-stretcher)

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
