# Music Studio — 2026 Remix Upgrade Runbook

Build and deploy the three hand-written "2026 Remix" App.jsx files for the
`music-studio.hbs` landing page, then update the page to flip the remix cards
from "Coming soon" to live.

## Context

`src/pages/music-studio.hbs` is already live. It shows:

- **Section 1 — The Originals**: three deployed apps by user `og`
  - `excited-wombat-4753` — Dr. Deas Drum Machine (AI generator + step sequencer)
  - `mass-bug-7792` — Dr. Deas Pattern Saver (instrument-first, LEVEL/TUNE/DECAY)
  - `environmental-newt-5799` — Dr. Deas Chord Synthesizer (MIDI import + AI progressions)

- **Section 2 — 2026 Remix**: three placeholder cards (`Coming soon`)
  - `drum-studio` (to deploy as `og`)
  - `pattern-vault` (to deploy as `og`)
  - `chord-studio` (to deploy as `og`)

The goal is to hand-write the three remix App.jsx files, push them, verify they
are live, and then update the landing page.

## Workflow overview

1. Set up local directories under `vibes/music-studio/`
2. Write each App.jsx (see specs below)
3. Push each app with the CLI (trust the tool response)
4. Take screenshots via MCP and visually review
5. Polish if needed (edit → push → screenshot loop)
6. Update `music-studio.hbs` to flip all three remix cards to live
7. `pnpm check` → `open _site/music-studio.html` → final review
8. Commit

---

## Step 1 — Directory setup

```sh
mkdir -p vibes/music-studio/drum-studio
mkdir -p vibes/music-studio/pattern-vault
mkdir -p vibes/music-studio/chord-studio
```

Each directory needs only an `App.jsx`. The CLI `push` command reads all
`.jsx/.js/.ts/.tsx/.css/.html/.json/.md/.txt/.svg` files flat from the directory.

---

## Step 2 — Write App.jsx files

Use the frontend-design skill. These are hand-written React apps — not CLI-generated.
Guidelines:

- Plain React, no bundler. The runtime handles it.
- All audio via Web Audio API only (no external audio libraries).
- **Do NOT import Tailwind** — `import 'https://esm.sh/@tailwindcss/browser@4'` causes the runtime's import mapper to double-wrap the URL, producing a 400 that crashes the whole module. Use inline styles only.
- Fireproof (local-first DB) is available if persistence beyond localStorage is useful:
  `import { fireproof } from 'use-fireproof'`
- **Always** `import React from 'react'` — the runtime does NOT expose a global `React`.
- Export a default function component named `App`.

Start each app by reviewing the OG screenshot to understand existing behavior:

```sh
curl -sL https://excited-wombat-4753--og.prod-v2.vibesdiy.net/screenshot.jpg -o /tmp/drum-og.jpg
curl -sL https://mass-bug-7792--og.prod-v2.vibesdiy.net/screenshot.jpg      -o /tmp/pattern-og.jpg
curl -sL https://environmental-newt-5799--og.prod-v2.vibesdiy.net/screenshot.jpg -o /tmp/synth-og.jpg
```

Then use the Read tool to view each screenshot before writing.

---

## App 1 — Drum Studio (`vibes/music-studio/drum-studio/App.jsx`)

**What the OG does**: 8-track 16-step sequencer. AI beat generator (describe style +
genre dropdown). BPM slider. Solo/mute per track. Save/load patterns by name.
Custom samples auto-load. Step sequencer with PLAY/STOP/SAVE/NEW.

**What to add / fix in the remix**:

- Lookahead Web Audio scheduler (schedule 100ms ahead, tick every 25ms via
  `setInterval` on the scheduling loop only — never fire audio events from
  `setInterval` directly)
- Procedural drum synthesis via Web Audio API (no sample files required):
  - Kick: sine osc, exponential freq sweep 200Hz→40Hz in 80ms, decay 300ms
  - Snare: bandpass noise (180Hz–2kHz) 60/40 mixed with 200Hz sine, 150ms decay
  - Closed hat: white noise → highpass 8kHz, 60ms decay
  - Open hat: same, 400ms decay
  - Clap: 4 noise bursts 8ms apart, 200ms shared tail
  - Crash: bandpass noise, 800ms decay
  - Cowbell: two square waves 540Hz + 800Hz, 8ms attack, 600ms decay
  - Clave: sharp click, 40ms
- Step grid: 16 steps as 4 groups of 4, thin visual separator between groups
- Per-track: volume slider, tune slider (±12 semitones), solo [S], mute [M]
- Master Bus panel (grouped):
  1. DynamicsCompressorNode — Threshold (−60 to 0 dB, default −24), Ratio
     (1:1–20:1, default 4:1), Attack (0–200ms, default 3ms), Release
     (50ms–2000ms, default 250ms)
  2. WaveShaperNode — tanh soft-clip curve, pre-gain stage 0.5×–3×. Expose as
     **Tube Warmth** knob (0–100) with numeric pre-gain label
  3. Master volume GainNode slider
- Pattern auto-save to localStorage on every change; "saved" toast 1s
- AI generator: text description + genre dropdown → fills all 8 tracks, spinner
  during fetch

**Showcase features**: Master Bus panel with Dynamics Compressor + Tube Warmth knob.

---

## App 2 — Pattern Vault (`vibes/music-studio/pattern-vault/App.jsx`)

**What the OG does**: Drum machine (Dr. Deas) with KICK/SNARE/HAT etc. tracks,
LEVEL/TUNE/DECAY per instrument, step sequencer, AI Generate, demo patterns,
SAVE/NEW/PLAY.

**What to add / fix in the remix**:

- Two-panel layout: 280px left panel (pattern browser) + flex-1 right panel
  (live sequencer)
- Left panel — pattern browser:
  - Cards: name, tag chips, BPM label, mini 8×16 dot-grid preview (read-only)
  - Click to load. Active card highlighted. Sorted newest-first.
  - Tag filter row (click tag to filter, "Clear" to reset)
  - Search input filtering by name
- Tags: on Save, modal asks for name + tags (type + Enter to add, click to remove)
- Pattern URL sharing: encode state as base64 JSON in `window.location.hash`;
  Share button copies URL to clipboard, shows "Copied!" confirmation; on mount
  decode hash if present (malformed hash → error toast + empty state)
- Export: download full library as JSON; Import: merge from JSON file (name
  collision → append " (imported)"); show count toast
- Web Audio procedural synthesis (same voice set as Drum Studio above)
- Mobile (narrower than 768px): single column, toggle button to switch panels
  with 200ms slide transition

**Showcase feature**: tag + search library browser with shareable URL encoding.

---

## App 3 — Chord Studio (`vibes/music-studio/chord-studio/App.jsx`)

**What the OG does**: Chord synthesizer with MIDI file import (drag-drop .mid,
auto-detects chords, converts to playable progressions). AI chord progression
generator with auto-rhythm. "Click anywhere to start audio."

**What to add / fix in the remix**:

- Chord selector: root note (C–B), scale dropdown (Major, Natural Minor,
  Harmonic Minor, Dorian, Phrygian, Mixolydian, Pentatonic Major, Pentatonic
  Minor, Blues), diatonic chord grid labeled with Roman numerals + chord names.
  Octave selector 3–6.
- Voicing selector (global): Close / Open / Drop-2 (affects MIDI note numbers)
- Two-octave piano keyboard visual: highlights active chord notes; in Arpeggio
  mode highlights each note as it fires; non-diatonic keys dimmed
- Two playback modes (radio toggle):
  - Chord: all notes simultaneously, sustained until new chord or Stop
  - Arpeggio: Rate (1/4, 1/8, 1/16 note at BPM), Direction (Up/Down/Up-Down/
    Random), Gate (20–100%), re-triggers envelope per step
- Synthesis: OscillatorNode per note, waveform selector (sine/triangle/sawtooth/
  square), GainNode amplitude envelope (attack 10ms, release 400ms)
- Master chain:
  1. DynamicsCompressorNode: −20dB, 6:1, 5ms, 100ms (hardcoded, not exposed)
  2. WaveShaperNode: tanh soft-clip, **Tube Warmth** knob 0–100 (pre-gain 0.5×–3×)
  3. ConvolverNode reverb: synthetic impulse (exp noise decay 1.5s), **Reverb Mix**
     knob 0–100 (wet/dry via two GainNodes)
- AI progression generator: text input + length (4 or 8), returns diatonic chord
  sequence displayed as step buttons; Play Sequence cycles them at 1 chord/bar
- MIDI import: drag-drop .mid, group notes within 50ms into chords, display
  as step sequence, playable the same way as AI-generated
- Save/load named progressions to localStorage

**Showcase features**: Arpeggiator mode + piano keyboard visual + reverb.

---

## Step 3 — Push each app

```sh
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"

cd vibes/music-studio/drum-studio
"$TSX" "$MAIN" push --user-slug og
cd ../pattern-vault
"$TSX" "$MAIN" push --user-slug og
cd ../chord-studio
"$TSX" "$MAIN" push --user-slug og
```

**Must `cd` into each app directory before pushing** — push reads the cwd.

If the slugs `drum-studio`, `pattern-vault`, or `chord-studio` are taken or stuck,
use `drum-studio-2026`, `pattern-vault-2026`, `chord-studio-2026` and update the
landing page slugs to match.

---

## Step 4 — Visual review via MCP

Take screenshots and review using the Chrome MCP on the wrapper URLs (never the subdomain directly):

```
https://vibes.diy/vibe/og/drum-studio
https://vibes.diy/vibe/og/pattern-vault
https://vibes.diy/vibe/og/chord-studio
```

Use `mcp__chrome-devtools__navigate_page` → `mcp__chrome-devtools__take_screenshot`. Check:

- Audio starts on click (Web Audio context requires user gesture)
- Drum Studio: Master Bus panel renders, Tube Warmth knob works
- Pattern Vault: two-panel layout, tag filter, URL hash sharing
- Chord Studio: piano keyboard highlights, arpeggiator rate changes, reverb mix

---

## Step 5 — Polish loop

Edit → push → screenshot → repeat.
See `agents/improve-app-via-screenshot.md` for the full loop.

---

## Step 6 — Update music-studio.hbs

Once all three remix apps are verified live, update `src/pages/music-studio.hbs`.

For **each** of the three remix cards, make two changes:

### Replace the placeholder screenshot

```html
<!-- BEFORE -->
<div class="card-shot">
  <div class="shot-soon">
    <div class="shot-soon-glyph">◈</div>
    <div class="shot-soon-label">Deploying soon</div>
  </div>
</div>

<!-- AFTER (example for drum-studio) -->
<div class="card-shot">
  <img
    src="https://drum-studio--og.prod-v2.vibesdiy.net/screenshot.jpg"
    alt="Drum Studio"
    onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"
  />
</div>
```

### Replace the Coming soon button

```html
<!-- BEFORE -->
<div class="card-actions">
  <span class="btn btn-soon">Coming soon</span>
</div>

<!-- AFTER (example for drum-studio) -->
<div class="card-actions">
  <a href="https://vibes.diy/vibe/og/drum-studio" class="btn btn-join">Join</a>
  <a href="https://vibes.diy/clone/og/drum-studio" class="btn btn-clone"
    >Clone</a
  >
  <a href="https://vibes.diy/remix/og/drum-studio" class="btn btn-remix"
    >Remix</a
  >
</div>
```

Apply the same pattern for `pattern-vault` and `chord-studio`.

If any slug changed from the defaults above, update the URLs to match.

---

## Step 7 — Build and verify

```sh
pnpm check
open _site/music-studio.html
```

Confirm all six cards show screenshots, remix cards have live Join/Clone/Remix
buttons, and the expandable specs still render correctly.

---

## Step 8 — Commit

```sh
pnpm check
# no non-.hbs files to prettier in this workflow
git add src/pages/music-studio.hbs vibes/music-studio/
git commit
```

Do not push to remote unless explicitly asked.

---

## Slug reference

| App           | Slug            | OG source                 |
| ------------- | --------------- | ------------------------- |
| Drum Studio   | `drum-studio`   | `excited-wombat-4753`     |
| Pattern Vault | `pattern-vault` | `mass-bug-7792`           |
| Chord Studio  | `chord-studio`  | `environmental-newt-5799` |

All deployed under user `og`.
