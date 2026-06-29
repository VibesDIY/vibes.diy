#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/ambient-presence"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Aether Brass. Load Google Fonts: Cinzel Decorative, Homemade Apple, Special Elite (display=optional). Body font Special Elite, monospace, 1rem. Background parchment #dcbfa6 with a subtle paper-grain (a faint repeating-linear-gradient at 1-2% opacity for grain). Text ink #3e2723. Surfaces parchment-dark #c4a482. Accents brass-mid #cfa562 / brass-dark #745428 / amber #ffaa00. Decorative elements only: brass-foil corners on cards, double-rule borders (2px solid + 1px inset offset 4px) like an antique label. Headings in Cinzel Decorative, uppercase, letter-spacing 0.08em, brass-dark color. Special accents in Homemade Apple (handwritten cursive). Buttons: brass-mid border, rounded 0px corners, hover fills brass-dark with parchment text. Inputs: transparent bg with bottom border ink, type-on-parchment feel. Tone: late-night radio operator, leather-bound logbook, faint static warmth. Single-file React with useFireproof; persist activity as Fireproof docs and render past entries below the live surface.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen ascii-ptt-room "ASCII PTT Room — push-to-talk video walkie-talkie for a small friend group. Each user enters a handle and joins the room. Hold the [ HOLD TO TALK ] button: the app captures webcam frames at 10fps, downsamples each frame to a small ASCII grid (50x25 chars rendered in monospace), and writes a Fireproof doc per frame { handle, ascii, ts } plus an audio blob. Other users see a single full-width pane with the active speaker's ASCII video auto-playing as new frames arrive. Below: a feed of the last 5 PTT clips per user, replayable. Show a roster of who is currently in the room with a tiny pulse dot for whoever is talking. $STYLE"

gen crayon-video-chat "Crayon-Rendered Video Chat — a 2-4 person video room where the webcam pixels are redrawn as crayon strokes (canvas-based filter: detect edges, paint thick wax-stroke outlines + soft fill). Each user sees the room as a grid of crayon-rendered tiles. The aesthetic IS the privacy. A small slider per user adjusts stroke density (FINE / MEDIUM / WAX-CRAYON-CHUNKY). A [ SAVE FRAME ] button per tile snapshots the current crayon-rendered image as a Fireproof doc with timestamp; the gallery below shows every member's saved frames as a paper scrapbook strip. No audio; presence is purely visual. $STYLE"

gen 8bit-live-avatar "8-bit Live Avatar — face-tracked pixel sprite for hangouts where you don't want camera on. Each user picks a 16x16 pixel sprite from a small set (or types in a custom 16-char ASCII glyph). The webcam runs locally for face tracking only — face center, eye-blink, mouth-open are detected (use simple JS face-detection or fallback to a tap-to-blink button) and drive the sprite's animations: head tilt, blink frame, mouth-open frame. NO actual video on the wire — only the 3-4 booleans/floats per frame. Each user's sprite is shown as a tile in a shared room. A reaction palette at the bottom (HEART, LAUGH, NOD, SHRUG) emits a small floating sprite over your tile when tapped. Save room sessions as Fireproof docs. $STYLE"

gen phone-as-blacklight "Phone-as-Blacklight — a shared UV-simulation overlay for parties. The app opens the phone camera and renders the feed with a simulated UV-blacklight filter (heavy purple/violet tint, brightness boost on whites, glow on light surfaces). Tap [ SCAN ] to capture a freeze-frame and tag it (LINT, GLOW, SECRET) — saved as a Fireproof doc { uri, tag, by, ts }. The party gallery below shows everyone's scans in a wall layout — see what was 'invisible' at the party, in chronological order. A toggle adjusts UV intensity (LOW / MID / HIGH). $STYLE"

gen ascii-doorbell "ASCII Doorbell — a group-house front-door cam in ASCII. Designate one phone as the DOOR (it streams its camera as an ASCII grid). Other roommates open the app and see the latest 30-second loop of ASCII frames. When the doorbell rings (a [ RING ] button on the door device), every roommate's app pulses a notification card with the last 5 seconds of ASCII video. Each ring is a Fireproof doc { ts, ascii_frames, answered }. Roommates can tap [ I'LL GET IT ] to claim the answer; the door device shows who's coming. Below: a 7-day log of rings with answer status. $STYLE"

gen co-watch-ascii "Co-Watch with ASCII Reactions — sync-watch a video URL together with friends. The host pastes a YouTube/Vimeo URL; viewers join with the same room code. The video plays in sync (track host's currentTime in Fireproof). Below the video: a real-time ASCII overlay where reactions from each viewer render as floating ASCII text (LOL, WTF, ヽ(•‿•)ノ, *cry*) that fade over 3 seconds. Each reaction is a Fireproof doc { viewer, ascii, ts }. A timestamped reaction log replays per viewer at the bottom. Tone: silent movie palace with caption cards. $STYLE"

gen heartbeat-room "Heartbeat Room — a shared bpm wall. Each user's phone camera reads pulse from a fingertip held over the lens (use existing PPG techniques — measure brightness variation in the red channel over a 15-second window to detect bpm, fall back to manual tap-to-bpm if camera reading fails). Each user broadcasts their bpm as a Fireproof doc per measurement. The room view is a grid of named tiles, each pulsing visually at that user's bpm with a soft circular glow. A central readout shows ROOM AVERAGE BPM. A history below shows each user's bpm sparkline over the session. $STYLE"

gen voice-as-instrument "Voice-as-Instrument — a shared ambient loop where each user's mic is one note. Each user picks a note from a 7-note pentatonic palette (C, D, E, G, A, etc) — that becomes their assigned tone. When they hum or sing, the app detects pitch on their device and crossfades their mic-driven tone into a shared room loop. The loop view is a circle with each user as a point; their point glows brighter when they're sounding. A [ RECORD ROOM ] button captures 30 seconds of the room loop as an audio Fireproof doc; replay any past room recording. Tone: ambient music room, contemplative. $STYLE"

gen knock-app "Knock — tap to make a friend's phone thump. The app shows a list of named friend tiles. Tap a friend's tile and the app sends a [ KNOCK ] event (Fireproof doc { from, to, pattern, ts }) — their device receives the doc via live query and vibrates its physical buzzer in a chosen pattern (single tap, double tap, long buzz, morse SOS). The recipient sees a small toast 'jchris knocked' and can tap [ KNOCK BACK ]. A log below shows the day's knock exchanges as a small ledger. No words, no chat, just buzzes. $STYLE"

gen breath-circle "Breath Circle — visible group breathing rhythm. Each user joins a circle session by entering their handle. The screen shows the circle as user dots arranged in a ring; the ring expands and contracts visually on a shared 4-second-in / 4-second-hold / 4-second-out / 4-second-hold loop (box breathing). Users tap [ I'M HERE ] each cycle to sync their attendance — taps are Fireproof docs and contribute to a presence pulse on their dot. A central readout shows CIRCLE COUNT and SYNCED DOTS. After 5 minutes, an end summary saves the session (Fireproof doc) with attendance per cycle. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
