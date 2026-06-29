# pet-portrait-studio

> Upload a photo of a pet, then generate stylized AI portraits of them in different art styles (watercolor, renaissance painting, sci-fi cyberpunk, anime, oil painting). Use ImgVibes with the uploaded File passed via the images prop for img2img transformation. Keep the user's photo in state and let them pick a style from a grid of style buttons; show the generated portrait below. Save a gallery of past portraits via Fireproof useLiveQuery so they persist.

Live at [https://vibes.diy/vibe/jchris/pet-portrait-studio](https://vibes.diy/vibe/jchris/pet-portrait-studio)

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
