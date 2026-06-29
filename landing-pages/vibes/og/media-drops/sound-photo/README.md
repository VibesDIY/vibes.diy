# sound-photo

> Sound Photo — a 3-second audio card, shareable like an image. Anyone records 3 seconds of audio (mic captured, fixed length). The card renders as a small archive entry with a waveform visualization, a play button, location-of-capture (textfield, e.g. 'kitchen on a Tuesday'), and a 1-line caption. Each card is a Fireproof doc. Browse past sound-photos as a catalog list with waveform thumbnails. Tone: ambient field-recording journal. STYLE — Archive. Load Google Fonts: Playfair Display, Inter (display=optional). Headings in Playfair Display 700 (serif, magazine-archive feel). Body in Inter 400 1rem. Background page-bg oklch(0.92 0.01 65) (warm cream). Surface bg oklch(0.95 0.01 70). Text oklch(0.15 0.02 50) (near-black warm). Borders oklch(0.20 0.02 50) — single hairline 1px. Accent oklch(0.35 0.04 50) (deep sepia) for buttons + emphasis; accent-text oklch(0.95 0.01 70) (cream). Muted oklch(0.55 0.02 50). NO rounded corners (square archive cards). Layout: max-width 920px, generous gutters, two-column where appropriate. Use thin horizontal rules (1px) between sections, small caps tiny labels at 0.55-0.7rem with letter-spacing 0.12em uppercase. Buttons: filled accent bg with cream text; hover deepens. Inputs: bottom-bordered only. Pull-quotes in Playfair italic. Dropped-cap on lead paragraphs. The aesthetic: a museum exhibit catalog. Single-file React with useFireproof; persist drops as catalog entries below the live form, indexed by date.

Live at [https://vibes.diy/vibe/jchris/sound-photo](https://vibes.diy/vibe/jchris/sound-photo)

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
