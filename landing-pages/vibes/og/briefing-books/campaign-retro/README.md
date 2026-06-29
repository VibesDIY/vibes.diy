# campaign-retro

> Marketing Campaign Retro — owned per campaign, dies in 90 days. After a campaign ships, create a retro doc: campaign name, goal, actual results, what worked, what didn't, lessons, owner-rotation. Multiple contributors can add notes (each contribution is a Fireproof doc tagged to the retro). The retro auto-archives at 90 days but remains searchable. The home view: list of active retros (not yet archived) plus an archive search. Tone: brief, blame-free, learning-oriented. Export a retro as a one-page briefing PDF. STYLE — Dossier Card. Load Google Fonts: Archivo Black, Roboto Mono (display=optional). Body Roboto Mono 1rem (monospace). Display headings Archivo Black, uppercase, letter-spacing -0.02em (heavy slab-bold). Background bg oklch(0.16 0 0) (near-black). Card surfaces oklch(0 0 0) (pure black). Foreground oklch(1 0 0) (pure white). Border oklch(0.28 0.03 257) (cool blue-gray) 1px hairline. NO color outside black/white plus the cool blue-gray border tint and a single subtle accent stripe (use border tone for it). Sharp corners. Layout is a numbered briefing book: each section labeled "EXHIBIT 01 / EXHIBIT 02 / ..." in Archivo Black. Tables in Roboto Mono with clear cell borders. Buttons render as bordered rectangles "[ FILE ]" with Archivo Black uppercase text; hover inverts to white-bg black-text. Inputs: transparent with cool-blue-gray bottom border, mono caret. Tone: an executive briefing dossier — confidential, weighty, paper-binder feel. NO playful elements. Single-file React with useFireproof; persist briefings as numbered exhibit entries.

Live at [https://vibes.diy/vibe/jchris/campaign-retro](https://vibes.diy/vibe/jchris/campaign-retro)

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
