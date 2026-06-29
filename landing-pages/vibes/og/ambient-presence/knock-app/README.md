# knock-app

> Knock — tap to make a friend's phone thump. The app shows a list of named friend tiles. Tap a friend's tile and the app sends a [ KNOCK ] event (Fireproof doc { from, to, pattern, ts }) — their device receives the doc via live query and vibrates its physical buzzer in a chosen pattern (single tap, double tap, long buzz, morse SOS). The recipient sees a small toast 'jchris knocked' and can tap [ KNOCK BACK ]. A log below shows the day's knock exchanges as a small ledger. No words, no chat, just buzzes. STYLE — Aether Brass. Load Google Fonts: Cinzel Decorative, Homemade Apple, Special Elite (display=optional). Body font Special Elite, monospace, 1rem. Background parchment #dcbfa6 with a subtle paper-grain (a faint repeating-linear-gradient at 1-2% opacity for grain). Text ink #3e2723. Surfaces parchment-dark #c4a482. Accents brass-mid #cfa562 / brass-dark #745428 / amber #ffaa00. Decorative elements only: brass-foil corners on cards, double-rule borders (2px solid + 1px inset offset 4px) like an antique label. Headings in Cinzel Decorative, uppercase, letter-spacing 0.08em, brass-dark color. Special accents in Homemade Apple (handwritten cursive). Buttons: brass-mid border, rounded 0px corners, hover fills brass-dark with parchment text. Inputs: transparent bg with bottom border ink, type-on-parchment feel. Tone: late-night radio operator, leather-bound logbook, faint static warmth. Single-file React with useFireproof; persist activity as Fireproof docs and render past entries below the live surface.

Live at [https://vibes.diy/vibe/jchris/knock-app](https://vibes.diy/vibe/jchris/knock-app)

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
