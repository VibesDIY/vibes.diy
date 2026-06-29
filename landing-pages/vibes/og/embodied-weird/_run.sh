#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/embodied-weird"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Rune Interface. Load Google Fonts: Cinzel, Cormorant Garamond (display=optional). Body in Cormorant Garamond, Georgia, serif, 1rem. Headings in Cinzel uppercase letter-spacing 0.15em. Background abyss #020406 with subtle abyss-blue #05101a panels. Cards stone #0d161f with border stone-border #1c2b38 1px (occasionally use stone-light #162330 elevated). Foreground text #b0c4cc; muted #4a6070. Accent cyan-neon #00ffcc with text-shadow 0 0 12px rgba(0,255,204,.6) on key headings. Secondary accent purple-magic #9d4eff for special states. cyan-text #ccfffa for emphasis paragraphs. cyan-dim #005f52 for subtle borders. Decorative motifs: thin geometric divider rules (single horizontal hairline interrupted with a small ◇ or ◊ glyph in cyan-neon), occasional rune-ish unicode (ᚠ ᚱ ᛗ ᛒ) used sparingly as section markers. Sharp corners only. Buttons render as bracketed serif text [ INVOKE ] [ ATTUNE ] with hover changing to filled cyan-neon background black text. Inputs: transparent with bottom border cyan-dim, glow on focus. Tone: a magical control panel for things that should not be possible. Single-file React with useFireproof; persist activity as glyph-style archive entries below the live surface.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen whisper-only "Whisper-Only Voice — dB cap on the mic, can't shout. The room shows a 4-tile grid of participants. Each tile shows the user's mic level as a thin glowing meter capped at a soft threshold (~50dB). When a user goes over the cap, their tile flashes purple and their audio is muted for 3s with a 'TOO LOUD' rune label. Each over-cap event is a Fireproof doc. Past sessions show the participant who was 'most-restrained' (longest streak under cap). Tone: a quiet ritual room. $STYLE"

gen phone-tug-of-war "Phone Tug-of-War — accelerometer game for two phones. Two players join a tug-of-war session. Each phone reads its accelerometer's pull-strength every 50ms (simulate the pull from the 3-axis magnitude); whichever phone is moving more strongly gains rope-length. The shared room view shows a horizontal rope with a knot that drifts to whichever side is winning, and two glowing rune symbols at each end. First to drag the knot past their goal wins. Each match is a Fireproof doc with winner, duration, peak-pull. Leaderboard. $STYLE"

gen side-eye-cam "Side-Eye Cam — detects glance toward phone, logs the cadence. The phone's front camera runs locally for face-tracking only; when the user's face is in-frame it records a side-eye glance event (Fireproof doc). The home view shows today's side-eye cadence as a rune-marked timeline of glance events. Daily metric: SIDE-EYES PER HOUR. A weekly chart shows your most-glance-prone times. The point: an embodied diary of when you can't help looking at your phone. NO actual video on the wire — only timestamps and rough head-pose deltas. $STYLE"

gen phone-flipped "Phone-Flipped Status — face-down on the table = busy, broadcast to a friend group. The app uses the device orientation API to detect FACE-UP / FACE-DOWN. When you flip the phone face-down, your status flips to BUSY and that change writes a Fireproof doc { user, status, ts }. Other members see a rune-grid roster — each tile shows the member's current state with a glowing or dim rune. The cumulative time face-down per day is shown per user. A weekly heatmap of busy-time. No notifications — purely status broadcast. $STYLE"

gen group-horoscope "Group Horoscope Remix — collective rewrite of today's horoscope. The host posts today's prompt (a generic horoscope sentence). Each member rewrites the sentence with one twist (replace a word, append a clause, invert the meaning). Each rewrite is a Fireproof doc; remixes can chain (rewrite a rewrite). The day's tree of remixes renders as a branching ritual scroll, with the original at the top. Vote-up to surface favorites. Daily horoscope archive browsable. $STYLE"

gen gibberish-translator "Gibberish Couple Translator — feeds your private vocabulary. Two (or more) users build a shared lookup: enter pairs of (gibberish-word → real-word) for inside-joke vocab unique to your relationship. The translator screen has two text panes: type gibberish on the left, the right pane substitutes any matched gibberish words with their real meaning, in real time. Persist the lookup as Fireproof docs. A 'glossary' page lists all your private mappings, ritual-style. Tone: an arcane dictionary for two. $STYLE"

gen shared-rng "Shared RNG of the Day — everyone gets the same random number. The room generates one deterministic random number per local day (from a seed = group-id + date), so every member sees the same number 1-1000. The number is rendered massive in glowing cyan-neon rune-style. Below: a [ ASK ] section where members write a YES/NO question and the daily RNG decides (>500 = YES, ≤500 = NO). Each question + answer is a Fireproof doc. Past days' RNG numbers archived. The point: a shared cosmic decision-maker. $STYLE"

gen last-meal-gallery "Last Meal Gallery — one photo a day, no captions. Each member can post exactly one food photo per local-day. NO captions, NO comments, NO reactions. The gallery is a chronological wall of photos, each with just date + member-handle as a small label. Past months catalogued in a grid archive. Each entry is a Fireproof doc with photo, member, ts. The constraint is the silence. Tone: a contemplative food-diary, not Instagram. $STYLE"

gen outfit-check "Outfit Check — 3 friends thumb up/down before leaving. The user uploads a phone photo of their outfit and submits with a destination (1-line: 'date', 'job interview', 'wedding'). The app pings 3 selected friends; each can vote 👍 / 👎 within a 10-minute window. After 10 min the verdict shows: GO / RECONSIDER / NO majority. Each check + each vote is a Fireproof doc. Past outfit-checks browsable as a personal archive with the destination + verdict + voter handles. $STYLE"

gen scream-into-void "Scream-Into-the-Void Tuesday — synchronized weekly mic-open. Every Tuesday at a fixed local hour (e.g. 21:00), a 60-second scream window opens for the group. Each member can hold the mic and scream during the window — their audio is captured to a Fireproof doc. The shared view shows a circle of glowing tiles, one per member, growing brighter as their volume increases. NO audio playback for others — the screams are saved into a Tuesday vault. Past Tuesdays browsable; play any past scream privately. Cathartic ritual archive. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
