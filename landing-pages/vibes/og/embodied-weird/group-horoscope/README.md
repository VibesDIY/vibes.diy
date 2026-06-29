# group-horoscope

> Group Horoscope Remix — collective rewrite of today's horoscope. The host posts today's prompt (a generic horoscope sentence). Each member rewrites the sentence with one twist (replace a word, append a clause, invert the meaning). Each rewrite is a Fireproof doc; remixes can chain (rewrite a rewrite). The day's tree of remixes renders as a branching ritual scroll, with the original at the top. Vote-up to surface favorites. Daily horoscope archive browsable. STYLE — Rune Interface. Load Google Fonts: Cinzel, Cormorant Garamond (display=optional). Body in Cormorant Garamond, Georgia, serif, 1rem. Headings in Cinzel uppercase letter-spacing 0.15em. Background abyss #020406 with subtle abyss-blue #05101a panels. Cards stone #0d161f with border stone-border #1c2b38 1px (occasionally use stone-light #162330 elevated). Foreground text #b0c4cc; muted #4a6070. Accent cyan-neon #00ffcc with text-shadow 0 0 12px rgba(0,255,204,.6) on key headings. Secondary accent purple-magic #9d4eff for special states. cyan-text #ccfffa for emphasis paragraphs. cyan-dim #005f52 for subtle borders. Decorative motifs: thin geometric divider rules (single horizontal hairline interrupted with a small ◇ or ◊ glyph in cyan-neon), occasional rune-ish unicode (ᚠ ᚱ ᛗ ᛒ) used sparingly as section markers. Sharp corners only. Buttons render as bracketed serif text [ INVOKE ] [ ATTUNE ] with hover changing to filled cyan-neon background black text. Inputs: transparent with bottom border cyan-dim, glow on focus. Tone: a magical control panel for things that should not be possible. Single-file React with useFireproof; persist activity as glyph-style archive entries below the live surface.

Live at [https://vibes.diy/vibe/jchris/group-horoscope](https://vibes.diy/vibe/jchris/group-horoscope)

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
