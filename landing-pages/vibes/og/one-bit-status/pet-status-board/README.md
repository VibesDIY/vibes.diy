# pet-status-board

> Pet Status Board — for a household of 1–4 pet owners broadcasting their current pet's mood. Add a pet at the top (name, species). Each pet card has a single big tap target cycling through a fixed set of states with one tap: LOAF, ROCKET, DEMANDING, ASLEEP, ZOOMIES, CLOAKED. Each tap writes a Fireproof doc { petId, state, ts, by }. The pet card always shows the latest state large, with a pixel-art ASCII glyph rendered in monospace (e.g. LOAF = a small ASCII blob, ROCKET = an arrow). Below: a chronological state log for that pet. Below the cards: a household feed of the last 50 state transitions across all pets. No notifications. No editing past states. State changes only roll forward. STYLE — Terminal CRT phosphor display. Load Google Font VT323 (display=optional); body font is "VT323", monospace, font-size 18px, line-height 1.4. Background --bg oklch(0.16 0 0) near-black. Surface --terminal oklch(0 0 0 / 0.85). Foreground --green oklch(0.87 0.30 142) phosphor-green; muted --green-dim oklch(0.87 0.30 142 / 0.4); borders --green-border oklch(0.87 0.30 142 / 0.3); faint fills --green-faint oklch(0.87 0.30 142 / 0.1); pure --white oklch(1 0 0) reserved for accents. Apply text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7) on h1/h2/key numbers. Add a fixed full-screen CRT overlay (repeating-linear-gradient horizontal scanlines, rgba(0,255,0,0.03), 1px every 3px, pointer-events none, z-index 99). Add a 3px-tall scan-line sweep bar (gradient bottom-fade) animating top→bottom over 8s infinite, z-index 100. Status indicators are 6px round dots: active = solid --green with box-shadow 0 0 8px green-glow; inactive = --green-dim, no glow. Section labels uppercase, letter-spacing 0.1em, --green-dim, prefixed "SYS:" or "STATUS:" or "FEED:" where appropriate. Inputs and textareas: transparent bg, 1px solid --green-border, square corners, monospace caret blinks. Buttons render as bracketed text "[ RUN ]" "[ PING ]" "[ CLEAR ]" with hover changing to filled-green-on-black inverse. No emoji icons; use ASCII symbols or unicode block characters (▌ █ ░ ▒ ● ○ ▲ ▼ →). No rounded corners on cards, only on the 6px dots. Card frames are 1px --green-border with --terminal background. Build single-file React. Persist all writes as Fireproof docs via useFireproof; render past entries below the input as a reverse-chronological list inside the Terminal aesthetic.

Live at [https://vibes.diy/vibe/theme/pet-status-board](https://vibes.diy/vibe/theme/pet-status-board)

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
