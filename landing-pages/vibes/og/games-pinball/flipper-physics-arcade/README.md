# flipper-physics-arcade

> Single-ball pinball: two flippers (A and L keys), three pop bumpers, side rails, drain at bottom. Ball physics with gravity and bumper kick. Score increments on bumper hits, persists per-game in Fireproof. Show last 10 game scores below the playfield.

Live at [https://vibes.diy/vibe/og/flipper-physics-arcade](https://vibes.diy/vibe/og/flipper-physics-arcade)

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
