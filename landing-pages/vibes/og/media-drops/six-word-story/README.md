# six-word-story

> Six-Word Story Room — daily prompt, exactly six words, no editing after submit. The room has one prompt per day (host-set or auto-rotated). Members submit a six-word story (validated to exactly 6 words, no edit after). Stories are Fireproof docs. The day's stories render as a column of typeset entries — each in serif italic, attributed to the writer. After local midnight, the day closes; archive view browses past prompts and their full collected stories per day. STYLE — Archive. Load Google Fonts: Playfair Display, Inter (display=optional). Headings in Playfair Display 700 (serif, magazine-archive feel). Body in Inter 400 1rem. Background page-bg oklch(0.92 0.01 65) (warm cream). Surface bg oklch(0.95 0.01 70). Text oklch(0.15 0.02 50) (near-black warm). Borders oklch(0.20 0.02 50) — single hairline 1px. Accent oklch(0.35 0.04 50) (deep sepia) for buttons + emphasis; accent-text oklch(0.95 0.01 70) (cream). Muted oklch(0.55 0.02 50). NO rounded corners (square archive cards). Layout: max-width 920px, generous gutters, two-column where appropriate. Use thin horizontal rules (1px) between sections, small caps tiny labels at 0.55-0.7rem with letter-spacing 0.12em uppercase. Buttons: filled accent bg with cream text; hover deepens. Inputs: bottom-bordered only. Pull-quotes in Playfair italic. Dropped-cap on lead paragraphs. The aesthetic: a museum exhibit catalog. Single-file React with useFireproof; persist drops as catalog entries below the live form, indexed by date.

Live at [https://vibes.diy/vibe/jchris/six-word-story](https://vibes.diy/vibe/jchris/six-word-story)

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
