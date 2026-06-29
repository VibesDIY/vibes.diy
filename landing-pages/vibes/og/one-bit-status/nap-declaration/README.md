# nap-declaration

> Nap Declaration — a single-button broadcast for a friend group. The home screen has a giant button: [ DECLARE NAP ]. Tapping it opens a one-line input for ETA in minutes (default 25, presets 15/25/45/90). Submitting writes a Fireproof doc { name, ts_start, eta_minutes }. The user's status flips to NAPPING and a live countdown shows on their card. The button changes to [ WAKE ] which writes { name, woke: true, ts }. Other members see a feed of who's currently napping with live countdowns. Below: a 7-day nap log per user with average nap length and longest streak of consecutive nap days. A toggle on each user's own card 'AUTO-SNOOZE NOTIFICATIONS' just writes a flag — there is no actual notification integration, the flag is for vibes. Show a small histogram of nap start hours below the feed. No comments, no reactions. STYLE — Terminal CRT phosphor display. Load Google Font VT323 (display=optional); body font is "VT323", monospace, font-size 18px, line-height 1.4. Background --bg oklch(0.16 0 0) near-black. Surface --terminal oklch(0 0 0 / 0.85). Foreground --green oklch(0.87 0.30 142) phosphor-green; muted --green-dim oklch(0.87 0.30 142 / 0.4); borders --green-border oklch(0.87 0.30 142 / 0.3); faint fills --green-faint oklch(0.87 0.30 142 / 0.1); pure --white oklch(1 0 0) reserved for accents. Apply text-shadow: 0 0 10px oklch(0.87 0.30 142 / 0.7) on h1/h2/key numbers. Add a fixed full-screen CRT overlay (repeating-linear-gradient horizontal scanlines, rgba(0,255,0,0.03), 1px every 3px, pointer-events none, z-index 99). Add a 3px-tall scan-line sweep bar (gradient bottom-fade) animating top→bottom over 8s infinite, z-index 100. Status indicators are 6px round dots: active = solid --green with box-shadow 0 0 8px green-glow; inactive = --green-dim, no glow. Section labels uppercase, letter-spacing 0.1em, --green-dim, prefixed "SYS:" or "STATUS:" or "FEED:" where appropriate. Inputs and textareas: transparent bg, 1px solid --green-border, square corners, monospace caret blinks. Buttons render as bracketed text "[ RUN ]" "[ PING ]" "[ CLEAR ]" with hover changing to filled-green-on-black inverse. No emoji icons; use ASCII symbols or unicode block characters (▌ █ ░ ▒ ● ○ ▲ ▼ →). No rounded corners on cards, only on the 6px dots. Card frames are 1px --green-border with --terminal background. Build single-file React. Persist all writes as Fireproof docs via useFireproof; render past entries below the input as a reverse-chronological list inside the Terminal aesthetic.

Live at [https://vibes.diy/vibe/theme/nap-declaration](https://vibes.diy/vibe/theme/nap-declaration)

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
