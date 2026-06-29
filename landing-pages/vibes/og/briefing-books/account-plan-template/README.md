# account-plan-template

> Sales Rep Account Plan Template — top 10 accounts, owned by the rep, not Salesforce. Each account has: company, contacts (with role + relationship strength), key dates, deal-size, current opp-stage, recent-touches, threats, opportunities. The home view: top-10 ranked grid of account cards. Click for the full plan: contact map, key-dates timeline, threat/opp list, recent-touch log. Each touch is a Fireproof doc. Quarterly review export: all 10 plans into a single PDF-ready briefing. Tone: this is the rep's tool, not management's reporting. STYLE — Dossier Card. Load Google Fonts: Archivo Black, Roboto Mono (display=optional). Body Roboto Mono 1rem (monospace). Display headings Archivo Black, uppercase, letter-spacing -0.02em (heavy slab-bold). Background bg oklch(0.16 0 0) (near-black). Card surfaces oklch(0 0 0) (pure black). Foreground oklch(1 0 0) (pure white). Border oklch(0.28 0.03 257) (cool blue-gray) 1px hairline. NO color outside black/white plus the cool blue-gray border tint and a single subtle accent stripe (use border tone for it). Sharp corners. Layout is a numbered briefing book: each section labeled "EXHIBIT 01 / EXHIBIT 02 / ..." in Archivo Black. Tables in Roboto Mono with clear cell borders. Buttons render as bordered rectangles "[ FILE ]" with Archivo Black uppercase text; hover inverts to white-bg black-text. Inputs: transparent with cool-blue-gray bottom border, mono caret. Tone: an executive briefing dossier — confidential, weighty, paper-binder feel. NO playful elements. Single-file React with useFireproof; persist briefings as numbered exhibit entries.

Live at [https://vibes.diy/vibe/jchris/account-plan-template](https://vibes.diy/vibe/jchris/account-plan-template)

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
