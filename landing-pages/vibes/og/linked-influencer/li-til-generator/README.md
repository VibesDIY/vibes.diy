# li-til-generator

> Parody "Today I Learned" LinkedIn post generator. User types a mundane fact. App uses AI to format it as a self-important LinkedIn TIL post with corporate buzzword spin and a closing question for engagement. Save and list.

Live at [https://vibes.diy/vibe/jchris/li-til-generator](https://vibes.diy/vibe/jchris/li-til-generator)

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
