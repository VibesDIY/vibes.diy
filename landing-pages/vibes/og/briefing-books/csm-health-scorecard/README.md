# csm-health-scorecard

> CSM Customer Health Scorecard — bespoke per CSM, syncs back nightly. Each customer has a health score 0-100 derived from rep-tunable signals: usage trend, last-exec-touch, NPS-from-internal, ticket-volume, contract-renewal-window. The CSM defines the weights for their customers. Health = weighted sum. The home view: customers ranked by health (red <50, amber 50-75, green >75). Click for detail: signal breakdown, last 5 touches, scheduled tasks. Each signal-update is a Fireproof doc. A weekly digest: who moved up/down. STYLE — Dossier Card. Load Google Fonts: Archivo Black, Roboto Mono (display=optional). Body Roboto Mono 1rem (monospace). Display headings Archivo Black, uppercase, letter-spacing -0.02em (heavy slab-bold). Background bg oklch(0.16 0 0) (near-black). Card surfaces oklch(0 0 0) (pure black). Foreground oklch(1 0 0) (pure white). Border oklch(0.28 0.03 257) (cool blue-gray) 1px hairline. NO color outside black/white plus the cool blue-gray border tint and a single subtle accent stripe (use border tone for it). Sharp corners. Layout is a numbered briefing book: each section labeled "EXHIBIT 01 / EXHIBIT 02 / ..." in Archivo Black. Tables in Roboto Mono with clear cell borders. Buttons render as bordered rectangles "[ FILE ]" with Archivo Black uppercase text; hover inverts to white-bg black-text. Inputs: transparent with cool-blue-gray bottom border, mono caret. Tone: an executive briefing dossier — confidential, weighty, paper-binder feel. NO playful elements. Single-file React with useFireproof; persist briefings as numbered exhibit entries.

Live at [https://vibes.diy/vibe/jchris/csm-health-scorecard](https://vibes.diy/vibe/jchris/csm-health-scorecard)

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
