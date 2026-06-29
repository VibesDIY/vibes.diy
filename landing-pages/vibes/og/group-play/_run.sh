#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/group-play"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Scrapbook. Load Google Fonts: Caveat, Inter (display=optional). Headings in Caveat (handwritten cursive), body in Inter, base 1rem. Background desk oklch(0.93 0.03 130) (warm taped-down kraft tone) with a faint paper-fiber texture. Cards are paper oklch(0.97 0.01 80) sticky notes — slightly tilted (rotate -1deg to 2deg per card), drop shadow 0 4px 12px rgba(0,0,0,.12), corners square. Three accent papers: yellow oklch(0.93 0.12 95), pink oklch(0.90 0.06 10), blue oklch(0.90 0.05 240) — rotate through them per element. Ink text oklch(0.12 0.01 0); muted oklch(0.45 0.01 0). Decorative elements: dashed/scribbled borders on highlights, fake masking-tape strips at card corners (small rotated rectangles in muted tan), hand-drawn arrows and underlines. Buttons look like rubber-stamp ink — solid ink fill, slightly imperfect edges, hover lifts and tilts 2 degrees. NO emoji icons. Use cute Inter ALL-CAPS labels for status. Single-file React with useFireproof; persist as scrapbook entries shown below the live surface as a paper-stack.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen vote-on-anything "Vote-On-Anything — drop a question, the room reacts. The host enters a question and submits — saves as a Fireproof doc { question, ts, options: ['👍','👎','🤔'] } (rendered as cute scrapbook word-stamps YES / NO / HMMM). Voters tap their reaction; each tap is a Fireproof doc { questionId, voter, choice }. Live tallies render as three handwritten tally-mark stacks beneath the question. Below: a stack of past questions with their final tallies pinned on like polaroids. Refresh every 2s. $STYLE"

gen group-mad-libs "Group Mad Libs — a fill-blanks story for 3-6 people, one phone each. The host picks (or types) a story template with [BLANKS] tagged with parts of speech (NOUN, VERB, ADJECTIVE). Each blank is auto-assigned to a player (round-robin). Players see only their assigned blanks and submit. Once all are filled, the full story renders for everyone — read aloud sentence-by-sentence with a [ NEXT ] button. Save the assembled story as a Fireproof doc; the past stories below render as a scrapbook of completed pages. Optional voice synth for the read-aloud. $STYLE"

gen camera-roll-trivia "Camera-Roll Trivia — your friends guess what's in your photos. The host picks (or uploads) a photo from their device and crops/blurs it (a slider for blur intensity). Friends see the obscured photo and submit one-line guesses. Each guess is a Fireproof doc. After 60 seconds, the host reveals the photo and votes [ CLOSEST ] / [ FUNNIEST ] / [ MEH ] on each guess. Closest gets +3 pts, funniest +2, meh +1. Persistent leaderboard across rounds. Past rounds render as polaroid-pasted scrapbook entries with the winning guess captioned in handwriting. $STYLE"

gen hot-or-not-fridge "Hot-or-Not the Fridge — rate your roommate's groceries. Anyone in the household can [ ADD GROCERY ] (photo + name). The fridge wall shows each grocery item as a paper-pinned snapshot. Roommates rate each item HOT or NOT with one tap. Tally renders as an over-time HOT/NOT bar per item. Items with a strong NOT majority get a 'CONSIDER COMPOSTING' tag. Each rating is a Fireproof doc. Below: most-loved leaderboard and most-hated wall of shame. Tone: roommate banter, no actual judgment. $STYLE"

gen couch-karaoke "Couch Karaoke — a shared lyric stream where everyone hears each other. The host picks a song (paste lyrics + a song title; assume no streaming, lyrics are just text). The room-side view shows the lyric line scrolling, current line highlighted. Each participant's mic captures their attempt; mic levels render as a colored aura around their tile. Each line of lyrics is a Fireproof doc moment; scoring is a peer thumbs-up that any participant can give to the loudest singer of each line. End-of-song tallies show who got the most thumbs per song. Past songs as scrapbook concert-ticket-stub entries. $STYLE"

gen charades-emoji "Charades-by-Emoji — describe a movie/show/book in three emoji, race to guess. The host enters a title and three emoji; submits as a hidden Fireproof doc. Players see only the emoji + a [ GUESS ] input. First correct guess wins; partial-credit is awarded by edit distance to the real title. The host can manually accept close-enough guesses. Scoreboard tallies points across rounds. Past rounds render as scrapbook entries with the answer + winner handwritten in. Tone: family-game-night silly. $STYLE"

gen group-mood-ring "Group Mood Ring — each member's hex color blends into one room hue. Each user picks a color via a circular hue picker each session (saved as Fireproof doc { user, hex, ts }). The room hue is the average of all current colors (weighted by recency). The whole screen background is the room hue. Below: a strip of each member's individual color tile with their handle. A history below shows the room hue over the past hour as a horizontal color-bar timeline. Optional [ NUDGE ] button tells a member their color has gone stale (>1 hour old). $STYLE"

gen synchronized-stretch "Synchronized Stretch Break — phones chime, everyone stands up together. The host schedules a stretch break (sets a target local time, e.g. 14:30). At the chosen time every connected device flashes/buzzes/chimes simultaneously and shows a 60-second guided stretch (3 prompts: NECK ROLL / SHOULDER OPEN / TOE TOUCH, each with an animated stick-figure). Each user taps [ I DID IT ] to log attendance — Fireproof doc per attendance. The home screen shows TODAY'S ATTENDANCE as a roster of names with check marks. Past stretch breaks below as a small scrapbook of 'attendance was 4/5'. $STYLE"

gen humming-tuner "Group Humming Tuner — match the others' pitch, the room locks to a chord. Each user picks one note (e.g. C, E, G); they hum that note and the app does pitch-detection on their mic. A central display shows each member's tile with a meter showing how close they are to their target frequency (in cents off). When all members are within ±20 cents simultaneously, the room flashes 'CHORD LOCKED' and saves a Fireproof doc with timestamp + duration. Below: a 'chords locked' log of past lock-sessions. $STYLE"

gen shake-to-cheer "Shake-to-Cheer — accelerometers on all phones, simultaneous chime. The host calls a CHEER (a quick prompt like 'CHEER FOR THE BIRTHDAY' with a 5-second countdown). Every phone listens to its accelerometer; if it detects a shake during the window, that user contributes a chime. The host's view shows the count of cheers tallied + a combined audio (overlay of chime sounds). Each cheer is a Fireproof doc. Past cheers below render as scrapbook concert-ticket entries with the prompt + cheer count. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
