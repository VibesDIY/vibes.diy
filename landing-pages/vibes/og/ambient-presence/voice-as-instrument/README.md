# voice-as-instrument

> Voice-as-Instrument — a shared ambient loop where each user's mic is one note. Each user picks a note from a 7-note pentatonic palette (C, D, E, G, A, etc) — that becomes their assigned tone. When they hum or sing, the app detects pitch on their device and crossfades their mic-driven tone into a shared room loop. The loop view is a circle with each user as a point; their point glows brighter when they're sounding. A [ RECORD ROOM ] button captures 30 seconds of the room loop as an audio Fireproof doc; replay any past room recording. Tone: ambient music room, contemplative. STYLE — Aether Brass. Load Google Fonts: Cinzel Decorative, Homemade Apple, Special Elite (display=optional). Body font Special Elite, monospace, 1rem. Background parchment #dcbfa6 with a subtle paper-grain (a faint repeating-linear-gradient at 1-2% opacity for grain). Text ink #3e2723. Surfaces parchment-dark #c4a482. Accents brass-mid #cfa562 / brass-dark #745428 / amber #ffaa00. Decorative elements only: brass-foil corners on cards, double-rule borders (2px solid + 1px inset offset 4px) like an antique label. Headings in Cinzel Decorative, uppercase, letter-spacing 0.08em, brass-dark color. Special accents in Homemade Apple (handwritten cursive). Buttons: brass-mid border, rounded 0px corners, hover fills brass-dark with parchment text. Inputs: transparent bg with bottom border ink, type-on-parchment feel. Tone: late-night radio operator, leather-bound logbook, faint static warmth. Single-file React with useFireproof; persist activity as Fireproof docs and render past entries below the live surface.

Live at [https://vibes.diy/vibe/jchris/voice-as-instrument](https://vibes.diy/vibe/jchris/voice-as-instrument)

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
