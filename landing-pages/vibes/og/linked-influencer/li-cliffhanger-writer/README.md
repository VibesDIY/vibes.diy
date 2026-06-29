# li-cliffhanger-writer

> Parody LinkedIn cliffhanger post generator. User pastes a short user story or work anecdote into a textarea. App calls AI to rewrite it as a melodramatic LinkedIn post with cliffhangers, line breaks every sentence, and a "🧵 1/" thread opener. Save each generated post as a Fireproof doc, list saved posts below the form. Cringe-corporate tone parody.

Live at [https://vibes.diy/vibe/jchris/li-cliffhanger-writer](https://vibes.diy/vibe/jchris/li-cliffhanger-writer)

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
