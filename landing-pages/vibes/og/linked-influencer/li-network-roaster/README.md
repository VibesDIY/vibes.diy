# li-network-roaster

> LinkedIn network roaster. User pastes 5 connection names with their job titles (one per line, like "Sarah Chen — VP Marketing at Initech"). App uses AI to write a comedic "network analysis" of the user, grading their orbit. Output: a letter grade (A+ to F), a stats breakdown ("73% middle managers, 27% MLM recruiters"), and a 3-paragraph roast. Save analyses as Fireproof docs. List past roasts with their grades shown like a transcript.

Live at [https://vibes.diy/vibe/jchris/li-network-roaster](https://vibes.diy/vibe/jchris/li-network-roaster)

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
