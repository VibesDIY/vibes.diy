# dot-matrix-pinball-replay

> Pinball that records the ball's path during play and replays your best run on a dot-matrix-style overlay above the playfield. One ball, two flippers, three bumpers. Each round saves path + score in Fireproof; replay any past round from a list.

Live at [https://vibes.diy/vibe/og/dot-matrix-pinball-replay](https://vibes.diy/vibe/og/dot-matrix-pinball-replay)

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
