# long-exposure-photo

> Long-Exposure Group Photo — multiple phones combine over 10 seconds. Each participant taps [ EXPOSE ] to begin a 10-second capture; the app collects camera frames at 10fps and averages them into a single long-exposure-style image (motion blurs into trails, static parts stay sharp). Each finished long-exposure is a Fireproof doc. The room view shows everyone's exposures from the same session as a contact-sheet, plus a [ COMPOSITE ] button that averages multiple participants' exposures into a single shared frame. Sessions catalogued by event name. STYLE — Archive. Load Google Fonts: Playfair Display, Inter (display=optional). Headings in Playfair Display 700 (serif, magazine-archive feel). Body in Inter 400 1rem. Background page-bg oklch(0.92 0.01 65) (warm cream). Surface bg oklch(0.95 0.01 70). Text oklch(0.15 0.02 50) (near-black warm). Borders oklch(0.20 0.02 50) — single hairline 1px. Accent oklch(0.35 0.04 50) (deep sepia) for buttons + emphasis; accent-text oklch(0.95 0.01 70) (cream). Muted oklch(0.55 0.02 50). NO rounded corners (square archive cards). Layout: max-width 920px, generous gutters, two-column where appropriate. Use thin horizontal rules (1px) between sections, small caps tiny labels at 0.55-0.7rem with letter-spacing 0.12em uppercase. Buttons: filled accent bg with cream text; hover deepens. Inputs: bottom-bordered only. Pull-quotes in Playfair italic. Dropped-cap on lead paragraphs. The aesthetic: a museum exhibit catalog. Single-file React with useFireproof; persist drops as catalog entries below the live form, indexed by date.

Live at [https://vibes.diy/vibe/jchris/long-exposure-photo](https://vibes.diy/vibe/jchris/long-exposure-photo)

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
