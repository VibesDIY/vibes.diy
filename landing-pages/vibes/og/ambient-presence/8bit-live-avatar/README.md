# 8bit-live-avatar

> 8-bit Live Avatar — face-tracked pixel sprite for hangouts where you don't want camera on. Each user picks a 16x16 pixel sprite from a small set (or types in a custom 16-char ASCII glyph). The webcam runs locally for face tracking only — face center, eye-blink, mouth-open are detected (use simple JS face-detection or fallback to a tap-to-blink button) and drive the sprite's animations: head tilt, blink frame, mouth-open frame. NO actual video on the wire — only the 3-4 booleans/floats per frame. Each user's sprite is shown as a tile in a shared room. A reaction palette at the bottom (HEART, LAUGH, NOD, SHRUG) emits a small floating sprite over your tile when tapped. Save room sessions as Fireproof docs. STYLE — Aether Brass. Load Google Fonts: Cinzel Decorative, Homemade Apple, Special Elite (display=optional). Body font Special Elite, monospace, 1rem. Background parchment #dcbfa6 with a subtle paper-grain (a faint repeating-linear-gradient at 1-2% opacity for grain). Text ink #3e2723. Surfaces parchment-dark #c4a482. Accents brass-mid #cfa562 / brass-dark #745428 / amber #ffaa00. Decorative elements only: brass-foil corners on cards, double-rule borders (2px solid + 1px inset offset 4px) like an antique label. Headings in Cinzel Decorative, uppercase, letter-spacing 0.08em, brass-dark color. Special accents in Homemade Apple (handwritten cursive). Buttons: brass-mid border, rounded 0px corners, hover fills brass-dark with parchment text. Inputs: transparent bg with bottom border ink, type-on-parchment feel. Tone: late-night radio operator, leather-bound logbook, faint static warmth. Single-file React with useFireproof; persist activity as Fireproof docs and render past entries below the live surface.

Live at [https://vibes.diy/vibe/jchris/8bit-live-avatar](https://vibes.diy/vibe/jchris/8bit-live-avatar)

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
