# bigger-image-river

> Pet costume try-on. User uploads a photo of their pet, picks a costume from a grid (pirate, astronaut, dinosaur, wizard, superhero, princess, chef, ninja), then ImgVibes generates an img2img result showing the pet in that costume — keep the uploaded File in React state and pass via images prop with a prompt like 'Transform this pet into a [costume] outfit, full body, photorealistic'. Save favorites to Fireproof and show a gallery grid below.

Live at [https://vibes.diy/vibe/jchris/bigger-image-river](https://vibes.diy/vibe/jchris/bigger-image-river)

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
