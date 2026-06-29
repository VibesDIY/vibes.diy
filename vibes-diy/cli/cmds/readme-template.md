# {{APP_SLUG}}

> {{PROMPT}}

Live at [{{VIBE_URL}}]({{VIBE_URL}})

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory (production + public by default)
- `npx vibes-diy unpublish` — take this vibe down (reversible; code and data are kept)
- `npx vibes-diy publish` — bring it back / promote the latest draft to production
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
