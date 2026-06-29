# group-listening-drop

> Group listening session app. On first launch, ask user's genre/scene and save it. Host announces album + start time. Others join by name. Countdown to drop. Live reaction feed during playback. Genre shapes all copy.

Live at [https://vibes.diy/vibe/og/group-listening-drop](https://vibes.diy/vibe/og/group-listening-drop)

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
