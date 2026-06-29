# pyrex-return-tracker

> Build a single-file React app called Pyrex Return Tracker — 'whose tupperware is this?'. Use Fireproof via useFireproof from 'use-fireproof' for live sync across the host's family devices. Top of the screen has an add form: a file/camera input for a photo (store as Fireproof _files attachment), a short dish description text field ('lasagna pan, glass lid'), and an owner name field. Submit saves a doc shaped { type:'pyrex', desc, owner, photo, returned:false, createdAt }. Below, a responsive grid shows all unreturned containers as polaroid-style cards: photo thumbnail, owner name in bold, dish description, and a big green 'Mark Returned' button. Returned items move to a collapsible 'Returned ✓' section at bottom showing struck-through entries. Tone: a little weary, a little funny — header subtitle 'the fridge graveyard solver'. Friendly kitchen palette, rounded cards, mobile-first.

Live at [https://vibes.diy/vibe/og/pyrex-return-tracker](https://vibes.diy/vibe/og/pyrex-return-tracker)

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
