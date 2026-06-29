# li-haiku-reducer

> LinkedIn-to-haiku reducer. User pastes any long corporate LinkedIn post or manifesto into a textarea. App uses AI to compress it down to a sincere 3-line haiku (5-7-5 syllables) that captures what the post is actually saying — stripped of buzzwords, flattery, and filler. Display haiku in elegant serif typography below the input. Save each haiku as a Fireproof doc alongside the original source text. List past haikus, click to expand and see the original verbose post. Quiet, contemplative UI in contrast to the source material.

Live at [https://vibes.diy/vibe/jchris/li-haiku-reducer](https://vibes.diy/vibe/jchris/li-haiku-reducer)

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
