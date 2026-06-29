# ascii-ptt-room

> ASCII PTT Room — push-to-talk video walkie-talkie for a small friend group. Each user enters a handle and joins the room. Hold the [ HOLD TO TALK ] button: the app captures webcam frames at 10fps, downsamples each frame to a small ASCII grid (50x25 chars rendered in monospace), and writes a Fireproof doc per frame { handle, ascii, ts } plus an audio blob. Other users see a single full-width pane with the active speaker's ASCII video auto-playing as new frames arrive. Below: a feed of the last 5 PTT clips per user, replayable. Show a roster of who is currently in the room with a tiny pulse dot for whoever is talking. STYLE — Aether Brass. Load Google Fonts: Cinzel Decorative, Homemade Apple, Special Elite (display=optional). Body font Special Elite, monospace, 1rem. Background parchment #dcbfa6 with a subtle paper-grain (a faint repeating-linear-gradient at 1-2% opacity for grain). Text ink #3e2723. Surfaces parchment-dark #c4a482. Accents brass-mid #cfa562 / brass-dark #745428 / amber #ffaa00. Decorative elements only: brass-foil corners on cards, double-rule borders (2px solid + 1px inset offset 4px) like an antique label. Headings in Cinzel Decorative, uppercase, letter-spacing 0.08em, brass-dark color. Special accents in Homemade Apple (handwritten cursive). Buttons: brass-mid border, rounded 0px corners, hover fills brass-dark with parchment text. Inputs: transparent bg with bottom border ink, type-on-parchment feel. Tone: late-night radio operator, leather-bound logbook, faint static warmth. Single-file React with useFireproof; persist activity as Fireproof docs and render past entries below the live surface.

Live at [https://vibes.diy/vibe/jchris/ascii-ptt-room](https://vibes.diy/vibe/jchris/ascii-ptt-room)

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
