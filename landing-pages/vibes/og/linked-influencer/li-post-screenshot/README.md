# li-post-screenshot

> LinkedIn post screenshot maker. AI generates a parody post (author + content + reactions + comment count) from a one-line user prompt, then renders it as a screenshot-ready card with full LinkedIn styling so users can save the image. Add a "copy as image" button using html2canvas if possible, or just present the styled card large and clean. Save Fireproof docs of past generated posts.

Live at [https://vibes.diy/vibe/jchris/li-post-screenshot](https://vibes.diy/vibe/jchris/li-post-screenshot)

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
