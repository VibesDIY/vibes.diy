#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/edu-study"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status-flashcards.log" ) &
}

: > "$HERE/_status-flashcards.log"

gen pop-quote-flip "React flashcard app seeded with pop-culture movie and TV quotes.

CORE MECHANIC: Show cards one at a time. Card front: the quote text. Card back: character name + show or movie title. The card is a large centered rectangle. Clicking or tapping anywhere on it triggers a smooth 3D flip animation (CSS perspective + rotateY 180deg, 400ms ease-in-out). After flipping, show two big buttons: GOT IT (green) and NOPE (red/orange). GOT IT removes the card from the current round queue. NOPE returns it to a random position in the remaining queue. When all cards are gone, show a round-complete screen with a score (GOT IT count / total) and a Shuffle and Play Again button.

DECK GENERATION: Always-visible Generate button opens a single-line input: 'Type a show, movie, or genre...' Pressing Go calls callAI with schema {cards:[{front:string,back:string}]} requesting 20 cards. front = the quote text. back = '— {Character}, {Show or Movie}'. Show a loading spinner on the card area during generation. Generated cards save to Fireproof and replace the current deck.

PARTY MODE: A toggle switch labeled Party Mode. When on, after each card result the screen briefly shows 'Pass to next player!' in large text for 2 seconds, then auto-advances. Player names are entered at start (2-6 players). Each player's score tracked in local state, shown on round-complete screen. One phone passed around the table.

PRE-SEEDED START: On first load if no deck exists in Fireproof, call callAI automatically with topic 'classic movies and TV shows, comedy and drama, recognizable to people aged 20-50' to pre-seed 20 cards without requiring user input. Show a loading card while generating.

PERSIST in Fireproof: deck doc ({id, topic, cardIds, createdAt}), card docs ({id, deckId, front, back}). Session state (current queue, scores) in React local state — resets on reload.

VISUAL STYLE: Bold party game energy. Near-black background (#0d0d0d). Electric yellow (#FFE600) as primary accent. Hot coral (#FF4D5B) as secondary. Space Grotesk (800 weight) for card quote text. JetBrains Mono for labels, scores, UI chrome. The card itself: large (min-height 260px, max-width 480px), white background, 3px yellow border, 6px yellow drop shadow, 20px border-radius. Back face: hot coral background, white text. Buttons: large (min 120px wide), thick borders, strong hover states. Confetti burst (pure CSS keyframes, no library) on round completion.

Don't import any external libraries beyond Fireproof and callAI. React hooks only."

gen vocab-deck-builder "React vocabulary flashcard app for self-directed study on any topic.

CORE MECHANIC — FLIP DECK: Show cards one at a time. Card front: term or concept. Card back: definition or explanation. Tapping the card flips it (CSS rotateY 180deg, 350ms). After flip, two buttons: KNOWN (soft green, ✓ icon) and STILL LEARNING (amber, ↩ icon). KNOWN moves card to done pile. STILL LEARNING returns it to queue. Progress bar at top: done/total, percentage. When queue is empty show session summary: '{n} learned this session · {m} total in deck' with Keep Drilling and Done for Now buttons. Shuffle deck on session start.

DECK CREATION: Home screen has a prominent topic input: 'What are you studying?' with a large Generate Deck button. callAI schema: {title:string, cards:[{front:string,back:string}]} — 20 cards per deck. front is the term, back is the definition or explanation. Show inline skeleton loading animation during generation (3 shimmer card shapes). Topic examples shown as small clickable chips below the input: 'Spanish verbs · Cell biology · Constitutional amendments · AWS services'

Manual add form (collapsible, always accessible): two text inputs labeled Term and Definition, an Add Card button. Appends to the current deck.

DECK LIST: A top dropdown (or left sidebar on wide screens) labeled 'My Decks ({n})' lists all saved deck titles with card counts. Click to load. Trash icon deletes deck and all its cards.

PERSIST in Fireproof: deck doc ({id, title, topic, cardIds, createdAt}), card docs ({id, deckId, front, back}), settings doc ({id:'settings', lastDeckId}) so last deck auto-loads on return visit. Session queue state in local React state.

VISUAL STYLE: Calm, focused study environment. Warm cream background (oklch(0.97 0.02 80)). Terracotta/coral accent (oklch(0.72 0.18 40)) for progress bar, KNOWN button, and active borders. Deep ink (#111) for text. Crimson Pro (serif, 400 and 600 weight) for card front and back text — large, readable. Inter for all UI buttons and labels. Card: centered, min-height 280px, max-width 560px, cream background, 2px solid #111 border, 4px terracotta drop shadow offset. Card back: soft terracotta tint background (#f5ddd0). Generous whitespace around card. No visual noise or decoration. Progress bar: thin (6px high), terracotta fill.

Don't import external libraries beyond Fireproof and callAI. React hooks only."

gen exam-card-drill "React certification flashcard app with three-level confidence tracking.

CORE MECHANIC — CONFIDENCE DRILL: Show cards one at a time. Card front: question or term. Card back: answer or definition, plus an optional hint. Tapping the card flips it (CSS rotateY, 350ms). After flipping, three confidence buttons: KNEW IT (green, ✓), UNSURE (amber, ~), MISSED IT (red, ✗).

Algorithm:
- Each card starts at confidence 0. Needs to reach confidence 2 to graduate to done pile.
- KNEW IT: increment confidence by 1. If confidence reaches 2, move to done pile. Otherwise put back in queue at position: queue.length (end).
- UNSURE: keep confidence same. Put back in queue at position: Math.min(3, queue.length).
- MISSED IT: reset confidence to 0. Put back in queue at position: 1 (next card up).
- Track confidence in session state object: {[cardId]: confidence}.

CONFIDENCE INDICATOR: Each card shows 2 small dots top-right. Dots fill as confidence increases (0 = both grey, 1 = one filled, 2 = both filled → card graduates).

PROGRESS BAR: Top of screen: 'Remaining: {r} · Drilling: {d} · Done: {k} / {total}'

HINT: Each card has an optional hint string. Show a small collapsible 'Show Hint' link below the card front (before flipping). Clicking it reveals the hint text in small italics.

DECK CREATION: Landing screen with domain input: 'Certification or subject area...' and a Generate Deck button. callAI schema: {title:string, cards:[{front:string,back:string,hint:string}]} — 25 cards. hint may be empty string. Show loading state during generation.

Manual add form: Front / Back / Hint (optional) text inputs + Add Card button.

DECK LIST: Sidebar list of saved deck titles. Each shows title, card count, last-drilled date. Click to load. Delete button removes deck + cards.

COMPLETION SCREEN: When all cards done — time elapsed, total flips, accuracy rate (KNEW IT count / total ratings). Two options: 'Drill weak cards only' (reset only MISSED IT + UNSURE cards to confidence 0, remove done cards from queue) or 'Full Reset' (reset all to confidence 0).

PERSIST in Fireproof: deck doc ({id, title, topic, cardIds, createdAt}), card docs ({id, deckId, front, back, hint}), session doc ({id, deckId, startedAt, cardConfidence:{[cardId]:0|1|2}, remainingIds:[], doneIds:[]}) — resume in-progress session on reload.

VISUAL STYLE: Clinical precision. Off-white background (#F8F8F6). Near-black text (#111). Deep blue-green accent (#1B6CA8) for borders, progress bar fill, filled confidence dots. Fonts: Inter (400/600/800) throughout — no serif, exam territory. Card: white, 2px solid #111 border, 8px border-radius, subtle box-shadow (0 2px 8px rgba(0,0,0,0.08)). Confidence dots: 2 small circles (10px diameter) top-right corner, filled with #1B6CA8 when earned, grey outline when not. Buttons: full-width, high contrast, clear color coding. No decorations, no illustrations.

Don't import external libraries beyond Fireproof and callAI. React hooks only."

wait
echo "ALL DONE" >> "$HERE/_status-flashcards.log"
