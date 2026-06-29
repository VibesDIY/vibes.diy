# couch-karaoke

> Couch Karaoke — a shared lyric stream where everyone hears each other. The host picks a song (paste lyrics + a song title; assume no streaming, lyrics are just text). The room-side view shows the lyric line scrolling, current line highlighted. Each participant's mic captures their attempt; mic levels render as a colored aura around their tile. Each line of lyrics is a Fireproof doc moment; scoring is a peer thumbs-up that any participant can give to the loudest singer of each line. End-of-song tallies show who got the most thumbs per song. Past songs as scrapbook concert-ticket-stub entries. STYLE — Scrapbook. Load Google Fonts: Caveat, Inter (display=optional). Headings in Caveat (handwritten cursive), body in Inter, base 1rem. Background desk oklch(0.93 0.03 130) (warm taped-down kraft tone) with a faint paper-fiber texture. Cards are paper oklch(0.97 0.01 80) sticky notes — slightly tilted (rotate -1deg to 2deg per card), drop shadow 0 4px 12px rgba(0,0,0,.12), corners square. Three accent papers: yellow oklch(0.93 0.12 95), pink oklch(0.90 0.06 10), blue oklch(0.90 0.05 240) — rotate through them per element. Ink text oklch(0.12 0.01 0); muted oklch(0.45 0.01 0). Decorative elements: dashed/scribbled borders on highlights, fake masking-tape strips at card corners (small rotated rectangles in muted tan), hand-drawn arrows and underlines. Buttons look like rubber-stamp ink — solid ink fill, slightly imperfect edges, hover lifts and tilts 2 degrees. NO emoji icons. Use cute Inter ALL-CAPS labels for status. Single-file React with useFireproof; persist as scrapbook entries shown below the live surface as a paper-stack.

Live at [https://vibes.diy/vibe/jchris/couch-karaoke](https://vibes.diy/vibe/jchris/couch-karaoke)

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
