# slow-dating-letters

> Async deep-correspondence dating. Write to one person at a time, long-form, over two weeks. No photos exchanged until both agree to meet. App rate-limits to one reply per day. Day-7 prompt: 'what would surprise me about you.' Save letters as Fireproof docs.

Live at [https://vibes.diy/vibe/og/slow-dating-letters](https://vibes.diy/vibe/og/slow-dating-letters)

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
