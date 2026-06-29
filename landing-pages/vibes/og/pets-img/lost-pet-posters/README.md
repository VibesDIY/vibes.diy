# lost-pet-posters

> Lost pet poster maker. User uploads a photo of their missing pet, fills in name, last-seen location, and contact info, then ImgVibes generates a stylized 'MISSING' poster image — pass the uploaded File via images prop for img2img with a prompt that overlays the pet onto a vintage poster aesthetic with bold MISSING headline. Keep the photo in React state. Show prior posters from Fireproof useLiveQuery as a thumbnail strip.

Live at [https://vibes.diy/vibe/jchris/lost-pet-posters](https://vibes.diy/vibe/jchris/lost-pet-posters)

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
