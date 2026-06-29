#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/media-drops"
cd "$HERE"

# Pin the publishing namespace explicitly so a stale `vibes-diy login`
# default (account swap, re-auth, CLI upgrade) cannot land deploys at the
# wrong user-slug. See src/pages/featured-apps/README.md for context.
USER_SLUG="og"

STYLE='STYLE — Archive. Load Google Fonts: Playfair Display, Inter (display=optional). Headings in Playfair Display 700 (serif, magazine-archive feel). Body in Inter 400 1rem. Background page-bg oklch(0.92 0.01 65) (warm cream). Surface bg oklch(0.95 0.01 70). Text oklch(0.15 0.02 50) (near-black warm). Borders oklch(0.20 0.02 50) — single hairline 1px. Accent oklch(0.35 0.04 50) (deep sepia) for buttons + emphasis; accent-text oklch(0.95 0.01 70) (cream). Muted oklch(0.55 0.02 50). NO rounded corners (square archive cards). Layout: max-width 920px, generous gutters, two-column where appropriate. Use thin horizontal rules (1px) between sections, small caps tiny labels at 0.55-0.7rem with letter-spacing 0.12em uppercase. Buttons: filled accent bg with cream text; hover deepens. Inputs: bottom-bordered only. Pull-quotes in Playfair italic. Dropped-cap on lead paragraphs. The aesthetic: a museum exhibit catalog. Single-file React with useFireproof; persist drops as catalog entries below the live form, indexed by date.'

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen disposable-camera "Disposable-Camera Roll — exactly 24 photos for a single event, no preview, develops at midnight. The host names the event and start time. Anyone in the group can take photos through the app's camera capture; the count badges down from 24/24. Photos save to Fireproof but are stored in a dev-pending state — NO preview is rendered until the dev-time (configurable, default midnight local). At dev-time the roll opens: all 24 photos render in capture order as a single archive contact-sheet. Past rolls catalogued by event date. The constraint is the social object. $STYLE"

gen polaroid-a-day "One-Polaroid-A-Day Wall — strict daily limit, the constraint is the social object. Each member can post exactly ONE photo per local-day. Photo + 1-line caption render as a polaroid-shaped tile pinned on the household/group wall in a chronological feed (most-recent-day first). Trying to post a second photo today shows a 'TODAY IS COMPLETE' message. Past polaroids browsable by month in an archive grid view. Each polaroid is a Fireproof doc with poster, ts, photo, caption. $STYLE"

gen long-exposure-photo "Long-Exposure Group Photo — multiple phones combine over 10 seconds. Each participant taps [ EXPOSE ] to begin a 10-second capture; the app collects camera frames at 10fps and averages them into a single long-exposure-style image (motion blurs into trails, static parts stay sharp). Each finished long-exposure is a Fireproof doc. The room view shows everyone's exposures from the same session as a contact-sheet, plus a [ COMPOSITE ] button that averages multiple participants' exposures into a single shared frame. Sessions catalogued by event name. $STYLE"

gen sound-photo "Sound Photo — a 3-second audio card, shareable like an image. Anyone records 3 seconds of audio (mic captured, fixed length). The card renders as a small archive entry with a waveform visualization, a play button, location-of-capture (textfield, e.g. 'kitchen on a Tuesday'), and a 1-line caption. Each card is a Fireproof doc. Browse past sound-photos as a catalog list with waveform thumbnails. Tone: ambient field-recording journal. $STYLE"

gen smell-journal "Smell Journal — text-only descriptions of today's smells. Each entry is a date, location, smell description (free text), and an emotion tag (NOSTALGIC / OFFENSIVE / NEUTRAL / DELICIOUS / WEIRD). Saved as a Fireproof doc. The journal is a chronological catalog of entries rendered as archived index cards: date, location, description in serif, tag as a small caps label. Filter by tag. A keyword search across all entries. Surprisingly sticky: textual smell-archiving with no images at all. $STYLE"

gen six-word-story "Six-Word Story Room — daily prompt, exactly six words, no editing after submit. The room has one prompt per day (host-set or auto-rotated). Members submit a six-word story (validated to exactly 6 words, no edit after). Stories are Fireproof docs. The day's stories render as a column of typeset entries — each in serif italic, attributed to the writer. After local midnight, the day closes; archive view browses past prompts and their full collected stories per day. $STYLE"

gen anonymous-compliments "Anonymous Compliments Box — fixed group, anonymous by default. Each user is preset on first visit (joins a fixed group with named members). The home screen shows each member as a card; tap a member to drop an anonymous compliment (a textarea, anonymously). Compliments save as Fireproof docs { recipient, text, ts } (sender NOT recorded). The recipient sees an inbox of compliments addressed to them. A small dignity setting: optional sign-with-handle toggle if you want to take credit. Catalogued by recipient. Tone: kind, sincere, archive of small acts. $STYLE"

gen one-good-thing "One Good Thing Room — end-of-day post, closes at midnight. Each member can post ONE good thing from their day before local midnight. After midnight the day closes and the entries become archive. Each entry is a Fireproof doc { author, text, ts }. The home screen shows TODAY'S CATALOG: each member's tile shows whether they've posted yet or 'NOT YET' in muted. Past days browsable as a calendar; tap any past day to read its entries. $STYLE"

gen receipt-theater "Receipt Theater — drop a receipt, friends construct the story. Anyone uploads a receipt photo. Friends submit one-paragraph speculative narratives ('the night this person bought 8 bananas, 3 lottery tickets, and a single pickle...'). Each narrative is a Fireproof doc. The receipt + narratives render as an archive entry: receipt photo on the left, scrolling column of narratives on the right, attributed. A vote-up surfaces the funniest narrative. Past receipts catalogued by month. $STYLE"

gen mixtape-30s "30-Second Mixtape — everyone contributes one half-minute clip per week. The mixtape is a single ordered playlist that the group builds. Each member can record (mic, 30 seconds) or upload (audio file trimmed to 30s) one clip per week. Clips are Fireproof docs. The week's mixtape plays sequentially in submission order. Past mixtapes catalogued by week-of-year, browsable as a chronological archive — each week is a small album-style entry with a serif label and the contributors listed. $STYLE"

wait
echo "ALL DONE" >> "$HERE/_status.log"
