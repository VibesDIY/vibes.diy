# edu/study Quiz & Flashcard Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two landing pages (`edu/study/flashcards` and `edu/study/quizzes`) each showing three deployed Vibes DIY apps on a toy→mid→key learning ladder, and wire them into the site index.

**Architecture:** Static `.hbs` templates with `layout: "webring"` — self-contained HTML + CSS per page, Handlebars `{{#each apps}}` loop for app cards. Generation scripts background-deploy 6 apps via the local vibes-diy CLI. Pages build with `pnpm check`.

**Tech Stack:** Handlebars templates, vibes-diy CLI (local tsx), Fireproof (inside each generated app), `pnpm check` build, `curl` for deploy verification.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/pages/edu/study/flashcards.hbs` |
| Create | `src/pages/edu/study/quizzes.hbs` |
| Create | `vibes/edu-study/_run-flashcards.sh` |
| Create | `vibes/edu-study/_run-quizzes.sh` |
| Modify | `src/pages/index.hbs` (add 2 collection-card entries) |

---

## Task 1 — Create directories

**Files:** (shell only)

- [ ] **Step 1: Create page and vibes directories**

```bash
mkdir -p src/pages/edu/study
mkdir -p vibes/edu-study
```

- [ ] **Step 2: Verify**

```bash
ls src/pages/edu/study   # empty, no error
ls vibes/edu-study        # empty, no error
```

---

## Task 2 — Write `_run-flashcards.sh`

**Files:**
- Create: `vibes/edu-study/_run-flashcards.sh`

- [ ] **Step 1: Write the script**

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x vibes/edu-study/_run-flashcards.sh
```

---

## Task 3 — Write `_run-quizzes.sh`

**Files:**
- Create: `vibes/edu-study/_run-quizzes.sh`

- [ ] **Step 1: Write the script**

```bash
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
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status-quizzes.log" ) &
}

: > "$HERE/_status-quizzes.log"

gen what-type-quiz "React personality quiz where every answer maps to an archetype — no right or wrong answers.

QUIZ STRUCTURE: 8 questions. Each question has a prompt and 4 options. Each option maps to one of 4 archetypes. No timer. User taps an option, it highlights (thick accent border + soft fill). A 'Next' button appears after selection. Cannot change answer after tapping. After 8 questions, show result screen.

ARCHETYPES (fixed, baked into the app):
- The Architect: systems thinker, plans ahead, values clarity and structure. Color: deep blue (#2563EB). Famous examples: Ada Lovelace, Alan Turing.
- The Wildcard: improviser, high energy, values novelty and chaos. Color: coral (#FF6B6B). Famous examples: Nikola Tesla, Frida Kahlo.
- The Diplomat: empathetic, collaborative, values harmony and connection. Color: sage green (#22C55E). Famous examples: Fred Rogers, Nelson Mandela.
- The Analyst: data-driven, skeptical, values precision and evidence. Color: amber (#F59E0B). Famous examples: Marie Curie, Carl Sagan.

SCORING: Count how many options per archetype the user selected. Highest count wins. Ties: the archetype of the final question's selected option wins.

RESULT SCREEN: Full-screen reveal card. Archetype name in huge type (clamp(3rem, 12vw, 6rem), font-weight 900). A 3-sentence character description. 'You share this energy with: {name1} and {name2}'. A shareable text block: 'I'm a {Archetype}. What are you? → [url]' with a Copy to Clipboard button (navigator.clipboard.writeText). A 'Retake Quiz' button below that resets all answers.

QUIZ GENERATION: callAI generates questions on app startup (once, stored to Fireproof). Schema: {questions:[{prompt:string, options:[{text:string, archetype:'architect'|'wildcard'|'diplomat'|'analyst'}]}]}. Topic is always 'how you approach learning, problem-solving, and group work' — don't expose topic to user. Regenerate button in a small corner link for when the user wants fresh questions.

PERSIST in Fireproof: questions doc ({id:'questions', items:[...]}, generated once). Last result doc ({id:'lastResult', archetype, answersMap}) — show result screen immediately on return visit if exists.

VISUAL STYLE: Fun, warm, social. Background: diagonal gradient from warm coral to soft lavender (linear-gradient(135deg, #FFE4E1 0%, #E9D5FF 100%)). White question cards with 3px black border, 5px black offset drop-shadow. Fonts: Fredoka (600) for question text, Nunito (500) for option text. Selected option: yellow (#FDE047) background + 3px yellow border. Options: rounded full-width buttons, large touch targets (min 48px height). Result card: white background, archetype's color as a 8px top border stripe. Giant archetype name in Fredoka 900. No game-show sound effects (can't do audio). Confetti keyframe animation on result reveal.

Don't import external libraries beyond Fireproof and callAI. React hooks only."

gen topic-knowledge-check "React AI-powered knowledge check quiz on any topic.

HOME SCREEN: Large centered text input labeled 'What do you want to test yourself on?' with a large 'Generate Quiz' button below it. callAI schema: {title:string, questions:[{prompt:string,options:[string,string,string,string],correctIndex:number}]} — 10 questions. Show skeleton loading animation (3 shimmer card shapes) while generating. Small link below: 'My saved quizzes ({n})' opens a slide-in panel (or drawer) listing past quizzes by title. Each has a trash icon to delete.

QUIZ FLOW: One question at a time. Top: 'Question {n} of 10' + thin blue progress bar. Question prompt in large text. 4 option buttons, stacked, full-width, no letter labels — just the option text. Tapping selects it (blue border + light blue fill). A 'Confirm Answer' button appears. Tapping Confirm: locks selection, reveals correct (green fill + ✓) and if wrong also highlights user's choice in red + shows '✗ Correct answer: {text}' label below options. Then 'Next Question' button appears. No timer.

SCORE SCREEN: After question 10. Big centered fraction ({correct}/10). Percentage. Pass badge if ≥70% (green pill: 'PASS'), else 'NEEDS WORK' (amber pill). Per-question review list: each question number, user's selected text (colored red/green), correct text if different. Two buttons: 'Try Again' (same questions, new attempt) and 'New Quiz' (back to home).

PERSIST in Fireproof: quiz doc ({id, title, questionIds, createdAt}), question docs ({id, quizId, prompt, options:[string,string,string,string], correctIndex}), attempt docs ({id, quizId, startedAt, answers:{[questionId]:selectedIndex}, score:number, completedAt}). On reload: if a saved quiz exists, show home screen with most recent quiz pre-selected.

VISUAL STYLE: Clean, academic, zero fluff. Off-white background (oklch(0.96 0.005 240)). Electric blue accent (oklch(0.58 0.22 250)). Near-black text (#111). Fonts: Space Grotesk (700) for question prompts, Inter (400/500) for options and chrome. Question card: white background, 2px solid black border, 6px blue drop-shadow. Option buttons: white, 2px black border; hover: pale blue fill; selected: 3px blue border + pale blue fill; confirmed correct: green fill (#DCFCE7) + green border; confirmed wrong (user pick): red fill (#FEE2E2) + red border. Progress bar: thin (4px), blue fill. Score badge: pill shape, green or amber, bold white text. No illustrations. Clean horizontal rules between sections.

Don't import external libraries beyond Fireproof and callAI. React hooks only."

gen timed-exam-practice "React timed practice exam simulator with section scoring and pass/fail verdict.

EXAM SETUP SCREEN: Topic/subject input ('What are you being examined on?'). 'Generate Exam' calls callAI with schema: {title:string, passingScore:number, sections:[{name:string, questions:[{prompt:string,options:[string,string,string,string],correctIndex:number,explanation:string}]}]} — 20 questions total across 2-3 named sections (e.g. 'Core Concepts', 'Applied Knowledge', 'Edge Cases'). passingScore defaults to 70. explanation is a 1-2 sentence rationale shown after each answer.

Two user-editable settings below the input (pre-filled from AI output): Timer per question toggle (default on, 45 seconds) and Passing score input (number, default 70). A 'Begin Exam' button starts.

EXAM FLOW: Overall progress bar at top: 'Question {n} of 20'. Current section name label below it. Timer bar: full-width 4px bar below section label, counts from full to empty over 45 seconds. CSS animation: green → orange at 50% (via hue change or color transition), orange → red at 20%. Timeout auto-advances and marks question as incorrect. Question prompt in large text. 4 option buttons full-width. Tapping locks selection, stops timer, reveals explanation text (2 sentences, grey italic, below options), highlights correct option green + user's wrong option red. Then 'Next' button appears.

SCORE SCREEN:
- Hero: big centered '{correct}/20' + percentage. PASS (green banner) or FAIL (red banner) based on passingScore.
- Per-section table: section name | {correct}/{total} | percentage bar (thin, navy fill).
- Time stats row: avg time/question (formatted as '{n}s') · questions timed out: {n}.
- Full question review: an accordion (collapsed by default). Each item: question prompt, user's answer (color coded), correct answer, explanation.
- Buttons: 'Retake Exam' (same questions, reset) and 'New Exam' (back to setup).

RESUME: If an in-progress exam exists in Fireproof on reload, show a 'Resume your exam? ({n} of 20 answered)' prompt with Resume and Start Fresh buttons.

PERSIST in Fireproof: exam doc ({id, title, passingScore, sectionIds}), section docs ({id, examId, name, questionIds}), question docs ({id, sectionId, prompt, options, correctIndex, explanation}), attempt doc ({id, examId, startedAt, currentQuestion:number, answers:{[questionId]:{selectedIndex:number|null,timeMs:number}}, completedAt:null|string}).

VISUAL STYLE: High-stakes institutional. Off-white (#FAFAF8) background. Deep navy (#1A2B4A) for primary text, borders, accent fill. Timer bar: smooth CSS transition; navy fill at start, transitions to orange (#F5820A) at 50% remaining, red (#D93025) at 20%. Fonts: Archivo Black (700) for section headers, score verdict, and exam title. Inter (400/600) for everything else. Question card: white, 1px solid #D0D0D0 border, 6px border-radius, no shadow. Option buttons: full-width, white, 1px #ccc border, 48px min-height; confirmed correct: #E8F5E9 fill + #16A34A border; confirmed wrong (user): #FEE2E2 fill + #DC2626 border; correct when user was wrong: #16A34A border only (no fill). PASS banner: full-width green (#16A34A) bar above score. FAIL banner: full-width red (#DC2626). Section bars: navy fill, grey track. Serious, institutional. No color-accent chrome, no illustrations.

Don't import external libraries beyond Fireproof and callAI. React hooks only."

wait
echo "ALL DONE" >> "$HERE/_status-quizzes.log"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x vibes/edu-study/_run-quizzes.sh
```

---

## Task 4 — Write `flashcards.hbs`

**Files:**
- Create: `src/pages/edu/study/flashcards.hbs`

- [ ] **Step 1: Write the file (all apps start with `"live": false`)**

```hbs
{{!--
{
  "layout": "webring",
  "title": "Flashcard Decks | Vibes DIY edu/study",
  "description": "Three flashcard apps on a toy-to-key ladder — party quotes, vocab builder, and exam drill. Same flip-deck primitive, three rungs.",
  "ogUrl": "https://good.vibes.diy/edu/study/flashcards/",
  "source": "edu-study-flashcards",
  "apps": [
    {
      "num": "01",
      "rung": "TOY",
      "slug": "pop-quote-flip",
      "author": "og",
      "live": false,
      "title": "Quote Flip",
      "tagline": "Guess the character. Flip the card.",
      "desc": "A deck of movie and TV quotes on the front, character and show on the back. Party game format — pass the phone, race to flip before someone shouts the answer. Generate a new deck from any genre or show with a single tap. The AI builds 20 cards; you burn through them in ten minutes. Party Mode passes the phone between players and tracks each person's score. Remix for your own fandom."
    },
    {
      "num": "02",
      "rung": "MID",
      "slug": "vocab-deck-builder",
      "author": "og",
      "live": false,
      "title": "Vocab Deck",
      "tagline": "Type a topic, get a study deck.",
      "desc": "Type any subject — Spanish irregular verbs, cell biology terminology, constitutional amendments — and the AI generates a 20-card study deck in seconds. Flip front to back, mark Known or Still Learning, watch the progress bar fill. Decks persist across sessions; your last deck loads automatically. Manual card add for your own terms. Clean, distraction-free, no subscription."
    },
    {
      "num": "03",
      "rung": "KEY",
      "slug": "exam-card-drill",
      "author": "og",
      "live": false,
      "title": "Exam Drill",
      "tagline": "Confidence-rated cards for high-stakes prep.",
      "desc": "Three-button study mode: KNEW IT, UNSURE, MISSED IT. Cards you missed come back next. Cards you're unsure about cycle back in three. Only cards you aced twice in a row graduate to done. A dot indicator on each card shows your confidence level. Build decks from any certification domain — bar exam, NCLEX, AWS, PMP — or type your own. In-progress sessions resume on reload."
    }
  ]
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600;700;800;900&display=optional");

  :root {
    --cream: oklch(0.97 0.02 80);
    --terra: oklch(0.72 0.18 40);
    --ink:   oklch(0.10 0 0);
    --muted: oklch(0.55 0 0);
    --dot:   oklch(0.90 0.015 80);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: var(--cream);
    background-image: radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px);
    background-size: 24px 24px;
    color: var(--ink);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout {
    max-width: 1100px; margin: 0 auto; padding: 0 1.25rem;
    border-left: 2px solid var(--ink); border-right: 2px solid var(--ink);
    background: var(--cream);
  }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.25rem; border-bottom: 4px solid var(--ink);
    margin: 0 -1.25rem; padding-left: 1.25rem; padding-right: 1.25rem;
  }
  .topbar .brand { font-family: "Inter", sans-serif; font-weight: 900; letter-spacing: -0.02em; font-size: 1.25rem; }
  .topbar .meta { font-family: "Inter", monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .topbar .meta b { background: var(--terra); color: #fff; padding: 2px 6px; }

  .crumb {
    padding: 0.55rem 0;
    font-family: "Inter", sans-serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase;
    border-bottom: 2px solid var(--ink);
  }
  .crumb a:hover { background: oklch(0.90 0.06 40); }

  .hero {
    padding: 4rem 0 3.5rem; border-bottom: 4px solid var(--ink);
  }
  .hero .label {
    font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 1.5rem; display: inline-block; padding: 4px 10px;
    background: var(--ink); color: var(--cream);
  }
  .hero h1 {
    font-family: "Crimson Pro", Georgia, serif;
    font-size: clamp(3rem, 9vw, 6.5rem);
    font-weight: 600; line-height: 0.95; letter-spacing: -0.02em; margin-bottom: 1.5rem;
  }
  .hero h1 .hl {
    background: var(--terra); color: #fff; padding: 0 0.12em;
    display: inline-block; transform: rotate(-1deg);
    box-shadow: 5px 5px 0 var(--ink); border: 2px solid var(--ink); margin: 0.05em 0;
  }
  .hero p.lead { font-size: 1.1rem; max-width: 680px; line-height: 1.6; }

  .stats {
    display: grid; grid-template-columns: repeat(3, 1fr);
    border-bottom: 4px solid var(--ink);
  }
  @media (max-width: 600px) { .stats { grid-template-columns: repeat(3, 1fr); } }
  .stat-cell {
    padding: 1.25rem 1.5rem; border-right: 2px solid var(--ink);
  }
  .stat-cell:last-child { border-right: none; }
  .stat-cell .k { font-family: "Inter", sans-serif; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 0.4rem; }
  .stat-cell .v { font-family: "Inter", sans-serif; font-weight: 900; font-size: 1.3rem; letter-spacing: -0.02em; }

  .primitive {
    padding: 2.5rem 0; border-bottom: 4px solid var(--ink);
  }
  .primitive h2 {
    font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 1.25rem;
  }
  .primitive h2::before { content: "// "; }
  .primitive p { font-size: 1.05rem; max-width: 760px; line-height: 1.6; margin-bottom: 0.85rem; }
  .primitive .pull {
    font-family: "Crimson Pro", Georgia, serif; font-weight: 600;
    font-size: clamp(1.6rem, 3.5vw, 2.6rem); line-height: 1.15; letter-spacing: -0.01em;
    margin: 1.25rem 0; max-width: 800px;
  }
  .primitive .pull span { background: oklch(0.90 0.06 40); padding: 0 0.2em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }

  .section-label {
    padding: 1.5rem 0 0.75rem;
    font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    border-bottom: 2px dashed var(--ink); margin-bottom: 1.5rem;
  }
  .section-label::before { content: "// "; }

  .apps { display: flex; flex-direction: column; gap: 0; border-top: 2px solid var(--ink); border-bottom: 4px solid var(--ink); }
  .app {
    padding: 2rem 1.5rem; border-bottom: 2px solid var(--ink);
    display: grid; grid-template-columns: 80px 1fr 320px; gap: 2rem; align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: oklch(0.93 0.025 80); }

  .app .num-cell { display: flex; flex-direction: column; gap: 0.4rem; }
  .app .num { font-family: "Inter", sans-serif; font-weight: 900; font-size: 3rem; line-height: 0.85; letter-spacing: -0.04em; }
  .app .rung-badge {
    font-family: "Inter", sans-serif; font-size: 0.5rem; letter-spacing: 0.22em; text-transform: uppercase;
    padding: 3px 7px; border: 2px solid var(--ink); text-align: center; display: inline-block;
  }
  .app--live .rung-badge { background: var(--terra); color: #fff; border-color: var(--terra); }

  .app .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .app .body .title { font-family: "Crimson Pro", Georgia, serif; font-size: 2.2rem; font-weight: 600; letter-spacing: -0.01em; line-height: 1.05; }
  .app .body .tagline {
    font-family: "Inter", sans-serif; font-size: 0.75rem; padding: 5px 10px;
    background: oklch(0.90 0.06 40); display: inline-block; align-self: flex-start; border: 1px solid var(--ink);
  }
  .app .body .desc { font-size: 1rem; line-height: 1.55; }

  .app .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .app .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 2px solid var(--ink); background: var(--cream); }
  .app .shot img { width: 100%; height: 100%; object-fit: cover; }
  .app .shot-placeholder {
    padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: "Inter", sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; text-align: center;
  }
  .app .ctas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 2px solid var(--ink); }
  .app .ctas--single { grid-template-columns: 1fr; }
  .btn {
    text-align: center; padding: 0.55rem 0.5rem; background: transparent;
    border-right: 2px solid var(--ink);
    font-family: "Inter", sans-serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;
    color: var(--ink); cursor: pointer; transition: background 0.12s;
  }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--terra); color: #fff; }
  .prompt-link { font-family: "Inter", sans-serif; font-size: 0.7rem; text-decoration: underline; }
  .prompt-link:hover { background: oklch(0.90 0.06 40); }

  .epilogue { padding: 2.5rem 0; border-bottom: 4px solid var(--ink); }
  .epilogue h2 { font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 1rem; }
  .epilogue h2::before { content: "// "; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.55; margin-bottom: 0.75rem; }
  .epilogue .hl { background: oklch(0.90 0.06 40); padding: 1px 4px; }

  footer.term-footer {
    padding: 1rem 0; font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase;
    display: flex; justify-content: space-between;
  }
  footer.term-footer a:hover { background: oklch(0.90 0.06 40); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta"><b>EDU / STUDY</b> · flashcard decks</span>
  </header>

  <nav class="crumb">
    <a href="{{assetPrefix}}index.html">Home</a> &nbsp;›&nbsp; edu / study &nbsp;›&nbsp; Flashcard Decks
  </nav>

  <section class="hero">
    <span class="label">edu / study</span>
    <h1>The card<br/>is the <span class="hl">test</span>.</h1>
    <p class="lead">
      Three flashcard apps on a toy-to-key ladder. Same flip-deck primitive — front, back, mark it, move on — running from a party game to an exam drill. Pick the rung that matches your stakes.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell"><div class="k">Apps</div><div class="v">Three</div></div>
    <div class="stat-cell"><div class="k">Ladder</div><div class="v">Toy → Key</div></div>
    <div class="stat-cell"><div class="k">Engine</div><div class="v">Flip deck + Fireproof</div></div>
  </div>

  <section class="primitive">
    <h2>The Primitive</h2>
    <p>
      Every app here uses the same flip-deck engine: a card with a front and a back, an AI that fills the deck from any topic you name, and a study loop that tracks what you know and what you don't. The mechanics don't change — what changes is the stakes, the tone, and what you do with the cards after you flip them.
    </p>
    <p class="pull">
      Front is the question. Back is the answer. <span>What you do with the gap is the study.</span>
    </p>
    <p>
      Toy end: the cards are movie quotes and the point is to shout the answer before your friend does. Key end: the cards are certification exam questions and the confidence tracker keeps drilling you on the ones you missed until you genuinely know them. The middle: your own vocab, your own subject, clean and fast and no sign-up required.
    </p>
  </section>

  <div class="section-label">The Ladder</div>

  <section class="apps">
    {{#each apps}}
      <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
        <div class="num-cell">
          <div class="num">{{num}}</div>
          <div class="rung-badge">{{rung}}</div>
        </div>
        <div class="body">
          <h2 class="title">{{title}}</h2>
          <span class="tagline">{{tagline}}</span>
          <p class="desc">{{desc}}</p>
        </div>
        <div class="right">
          {{#if live}}
            <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot">
              <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}"
                onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/>
            </a>
            <div class="ctas">
              <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Open</a>
              <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
              <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
            </div>
            <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
          {{else}}
            <div class="shot"><div class="shot-placeholder">awaiting deploy</div></div>
            <div class="ctas ctas--single">
              <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
            </div>
          {{/if}}
        </div>
      </article>
    {{/each}}
  </section>

  <div class="epilogue">
    <h2>Read Me</h2>
    <p>
      The flashcard is the oldest study technology that still works. Front, back, flip, mark, repeat. Pre-AI you either bought a printed deck or made your own by hand. The form factor put a hard ceiling on what topics were worth the effort — no one made 200 handwritten NCLEX cards more than once. <span class="hl">Generated software removes the ceiling.</span> Any topic, 20 cards, one generation call. The study loop is yours to keep.
    </p>
    <p>
      All three apps here are remixable. If the party-game vibe is wrong for your use case, clone the Quote Flip and swap the generation prompt. If the exam drill's confidence algorithm doesn't match your subject, remix it. The primitive is open.
    </p>
  </div>

  <footer class="term-footer">
    <span>Vibes.diy · <a href="https://links.vibes.diy/homepage">homepage</a> · <a href="{{assetPrefix}}edu/study/quizzes.html">quizzes →</a></span>
    <span>// THREE RUNGS, ONE PRIMITIVE</span>
  </footer>
</div>
```

---

## Task 5 — Verify `flashcards.hbs` builds

- [ ] **Step 1: Run build**

```bash
pnpm check
```

Expected: no errors, output includes `edu/study/flashcards.hbs -> edu/study/flashcards.html`

- [ ] **Step 2: Open the built page**

```bash
open _site/edu/study/flashcards.html
```

Verify: page renders with 3 app cards showing "awaiting deploy" placeholders, correct skin (cream + terracotta), correct titles.

- [ ] **Step 3: Commit checkpoint**

```bash
git add src/pages/edu/study/flashcards.hbs
git commit -m "feat: add edu/study/flashcards page (apps pending deploy)"
```

---

## Task 6 — Write `quizzes.hbs`

**Files:**
- Create: `src/pages/edu/study/quizzes.hbs`

- [ ] **Step 1: Write the file (all apps start with `"live": false`)**

```hbs
{{!--
{
  "layout": "webring",
  "title": "Quiz Apps | Vibes DIY edu/study",
  "description": "Three quiz apps on a toy-to-key ladder — personality quiz, knowledge check, and timed exam practice. Same multiple-choice engine, three rungs.",
  "ogUrl": "https://good.vibes.diy/edu/study/quizzes/",
  "source": "edu-study-quizzes",
  "apps": [
    {
      "num": "01",
      "rung": "TOY",
      "slug": "what-type-quiz",
      "author": "og",
      "live": false,
      "title": "What Type Are You?",
      "tagline": "No right answers. Just archetypes.",
      "desc": "Eight questions, no correct answers. Every option maps to one of four archetypes — Architect, Wildcard, Diplomat, Analyst. Your tally reveals which one fits. The result card names your archetype in six-inch type, gives you a three-sentence description, and produces a one-tap share text. Pass it around the table. It's a conversation starter that happens to also be a quiz."
    },
    {
      "num": "02",
      "rung": "MID",
      "slug": "topic-knowledge-check",
      "author": "og",
      "live": false,
      "title": "Knowledge Check",
      "tagline": "Type a topic. Get ten questions. Find out what you actually know.",
      "desc": "Type any subject and the AI generates a ten-question multiple-choice quiz in seconds. Answer one at a time, confirm your pick, see the correct answer and a short rationale. Score at the end: right out of ten, pass-or-needs-work badge at 70%. Review every question. Retry the same quiz or generate a fresh one. Saved quizzes persist so you can come back to the ones worth repeating."
    },
    {
      "num": "03",
      "rung": "KEY",
      "slug": "timed-exam-practice",
      "author": "og",
      "live": false,
      "title": "Exam Practice",
      "tagline": "Timed. Sectioned. Scored. Pass or fail.",
      "desc": "Twenty questions, divided into two or three named sections by the AI. A 45-second countdown per question — the bar goes orange at half, red at 20%, auto-advances at zero. After the last question: overall score, per-section breakdown, time stats, pass-or-fail verdict against a configurable threshold. Full question review with explanations. In-progress exams survive a page reload. Build your prep deck from any certification or course subject."
    }
  ]
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=optional");

  :root {
    --sheet:  oklch(0.96 0.005 240);
    --blue:   oklch(0.58 0.22 250);
    --ink:    oklch(0.10 0 0);
    --muted:  oklch(0.55 0 0);
    --line:   oklch(0.88 0.005 240);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: var(--sheet);
    background-image: repeating-linear-gradient(0deg, var(--line) 0 1px, transparent 1px 28px);
    color: var(--ink);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout {
    max-width: 1100px; margin: 0 auto; padding: 0 1.25rem;
    border-left: 2px solid var(--ink); border-right: 2px solid var(--ink);
    background: var(--sheet);
  }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.25rem; border-bottom: 4px solid var(--ink);
    margin: 0 -1.25rem; padding-left: 1.25rem; padding-right: 1.25rem;
  }
  .topbar .brand { font-family: "Space Grotesk", sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 1.25rem; }
  .topbar .meta { font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .topbar .meta b { background: var(--blue); color: #fff; padding: 2px 6px; }

  .crumb {
    padding: 0.55rem 0;
    font-family: "Inter", sans-serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase;
    border-bottom: 2px solid var(--ink);
  }
  .crumb a:hover { background: oklch(0.82 0.08 250); color: #fff; }

  .hero { padding: 4rem 0 3.5rem; border-bottom: 4px solid var(--ink); }
  .hero .label {
    font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 1.5rem; display: inline-block; padding: 4px 10px;
    background: var(--ink); color: var(--sheet);
  }
  .hero h1 {
    font-family: "Space Grotesk", sans-serif;
    font-size: clamp(3rem, 9vw, 6.5rem);
    font-weight: 700; line-height: 0.92; letter-spacing: -0.03em; margin-bottom: 1.5rem;
  }
  .hero h1 .hl {
    background: var(--blue); color: #fff; padding: 0 0.12em;
    display: inline-block; transform: rotate(-0.5deg);
    box-shadow: 5px 5px 0 var(--ink); border: 2px solid var(--ink); margin: 0.05em 0;
  }
  .hero p.lead { font-size: 1.1rem; max-width: 680px; line-height: 1.6; }

  .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 4px solid var(--ink); }
  .stat-cell { padding: 1.25rem 1.5rem; border-right: 2px solid var(--ink); }
  .stat-cell:last-child { border-right: none; }
  .stat-cell .k { font-family: "Inter", sans-serif; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 0.4rem; }
  .stat-cell .v { font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 1.3rem; letter-spacing: -0.02em; }

  .primitive { padding: 2.5rem 0; border-bottom: 4px solid var(--ink); }
  .primitive h2 { font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 1.25rem; }
  .primitive h2::before { content: "// "; }
  .primitive p { font-size: 1.05rem; max-width: 760px; line-height: 1.6; margin-bottom: 0.85rem; }
  .primitive .pull {
    font-family: "Space Grotesk", sans-serif; font-weight: 700;
    font-size: clamp(1.6rem, 3.5vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em;
    margin: 1.25rem 0; max-width: 800px;
  }
  .primitive .pull span { background: oklch(0.82 0.08 250); color: #fff; padding: 0 0.2em; box-decoration-break: clone; -webkit-box-decoration-break: clone; }

  .section-label {
    padding: 1.5rem 0 0.75rem;
    font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    border-bottom: 2px dashed var(--ink); margin-bottom: 1.5rem;
  }
  .section-label::before { content: "// "; }

  .apps { display: flex; flex-direction: column; gap: 0; border-top: 2px solid var(--ink); border-bottom: 4px solid var(--ink); }
  .app {
    padding: 2rem 1.5rem; border-bottom: 2px solid var(--ink);
    display: grid; grid-template-columns: 80px 1fr 320px; gap: 2rem; align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: oklch(0.91 0.01 240); }

  .app .num-cell { display: flex; flex-direction: column; gap: 0.4rem; }
  .app .num { font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 3rem; line-height: 0.85; letter-spacing: -0.04em; }
  .app .rung-badge {
    font-family: "Inter", sans-serif; font-size: 0.5rem; letter-spacing: 0.22em; text-transform: uppercase;
    padding: 3px 7px; border: 2px solid var(--ink); text-align: center; display: inline-block;
  }
  .app--live .rung-badge { background: var(--blue); color: #fff; border-color: var(--blue); }

  .app .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .app .body .title { font-family: "Space Grotesk", sans-serif; font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.05; }
  .app .body .tagline {
    font-family: "Inter", sans-serif; font-size: 0.75rem; padding: 5px 10px;
    background: oklch(0.88 0.05 250); display: inline-block; align-self: flex-start; border: 1px solid var(--ink);
  }
  .app .body .desc { font-size: 1rem; line-height: 1.55; }

  .app .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .app .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 2px solid var(--ink); background: var(--sheet); }
  .app .shot img { width: 100%; height: 100%; object-fit: cover; }
  .app .shot-placeholder {
    padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: "Inter", sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; text-align: center;
  }
  .app .ctas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 2px solid var(--ink); }
  .app .ctas--single { grid-template-columns: 1fr; }
  .btn {
    text-align: center; padding: 0.55rem 0.5rem; background: transparent;
    border-right: 2px solid var(--ink);
    font-family: "Inter", sans-serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;
    color: var(--ink); cursor: pointer; transition: background 0.12s;
  }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--blue); color: #fff; }
  .prompt-link { font-family: "Inter", sans-serif; font-size: 0.7rem; text-decoration: underline; }
  .prompt-link:hover { background: oklch(0.88 0.05 250); }

  .epilogue { padding: 2.5rem 0; border-bottom: 4px solid var(--ink); }
  .epilogue h2 { font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 1rem; }
  .epilogue h2::before { content: "// "; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.55; margin-bottom: 0.75rem; }
  .epilogue .hl { background: oklch(0.88 0.05 250); padding: 1px 4px; }

  footer.term-footer {
    padding: 1rem 0; font-family: "Inter", sans-serif; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase;
    display: flex; justify-content: space-between;
  }
  footer.term-footer a:hover { background: oklch(0.88 0.05 250); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta"><b>EDU / STUDY</b> · quiz apps</span>
  </header>

  <nav class="crumb">
    <a href="{{assetPrefix}}index.html">Home</a> &nbsp;›&nbsp; edu / study &nbsp;›&nbsp; Quiz Apps
  </nav>

  <section class="hero">
    <span class="label">edu / study</span>
    <h1>What do you<br/>actually <span class="hl">know</span>?</h1>
    <p class="lead">
      Three quiz apps on a toy-to-key ladder. Same multiple-choice primitive — question, four options, confirm, see the answer — running from a personality reveal to a full timed practice exam. Pick the rung that matches your stakes.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell"><div class="k">Apps</div><div class="v">Three</div></div>
    <div class="stat-cell"><div class="k">Ladder</div><div class="v">Toy → Key</div></div>
    <div class="stat-cell"><div class="k">Engine</div><div class="v">Multiple choice + Fireproof</div></div>
  </div>

  <section class="primitive">
    <h2>The Primitive</h2>
    <p>
      Every app here uses the same quiz engine: a question with four options, an AI that generates the deck from any topic, and a scoring loop that shows you what you got right and explains what you got wrong. The mechanics don't change — what changes is what you do with the score.
    </p>
    <p class="pull">
      The question is the unit. <span>What you learn from the wrong answer is the point.</span>
    </p>
    <p>
      Toy end: the questions have no correct answers — they reveal which archetype you are and you share the result. Key end: the questions come in timed sections with a pass/fail threshold and a full breakdown by topic. The middle: ten AI-generated questions on any subject, confirm and review, retry until it sticks.
    </p>
  </section>

  <div class="section-label">The Ladder</div>

  <section class="apps">
    {{#each apps}}
      <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
        <div class="num-cell">
          <div class="num">{{num}}</div>
          <div class="rung-badge">{{rung}}</div>
        </div>
        <div class="body">
          <h2 class="title">{{title}}</h2>
          <span class="tagline">{{tagline}}</span>
          <p class="desc">{{desc}}</p>
        </div>
        <div class="right">
          {{#if live}}
            <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot">
              <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}"
                onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/>
            </a>
            <div class="ctas">
              <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Open</a>
              <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
              <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
            </div>
            <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
          {{else}}
            <div class="shot"><div class="shot-placeholder">awaiting deploy</div></div>
            <div class="ctas ctas--single">
              <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
            </div>
          {{/if}}
        </div>
      </article>
    {{/each}}
  </section>

  <div class="epilogue">
    <h2>Read Me</h2>
    <p>
      The multiple-choice quiz is a strange form. At the toy end it's a mirror — no correct answer, just which option feels most like you. At the key end it's a gate — answer enough correctly in the time given or you don't pass. <span class="hl">Most quiz tools pick one end and stay there.</span> These three cover the whole range, same engine, different configuration.
    </p>
    <p>
      All three are remixable. If the 45-second timer is wrong for your exam format, clone and adjust it. If you want 20 questions instead of 10 for the knowledge check, remix the prompt. The primitive is open — the rung labels are just a starting point.
    </p>
  </div>

  <footer class="term-footer">
    <span>Vibes.diy · <a href="https://links.vibes.diy/homepage">homepage</a> · <a href="{{assetPrefix}}edu/study/flashcards.html">← flashcards</a></span>
    <span>// THREE RUNGS, ONE PRIMITIVE</span>
  </footer>
</div>
```

---

## Task 7 — Verify `quizzes.hbs` builds

- [ ] **Step 1: Run build**

```bash
pnpm check
```

Expected: no errors, output includes `edu/study/quizzes.hbs -> edu/study/quizzes.html`

- [ ] **Step 2: Open the built page**

```bash
open _site/edu/study/quizzes.html
```

Verify: page renders with 3 app cards showing "awaiting deploy" placeholders, correct skin (off-white + blue rules + Space Grotesk), correct titles.

- [ ] **Step 3: Commit checkpoint**

```bash
git add src/pages/edu/study/quizzes.hbs
git commit -m "feat: add edu/study/quizzes page (apps pending deploy)"
```

---

## Task 8 — Run generation scripts

- [ ] **Step 1: Run both scripts in parallel (background)**

```bash
bash vibes/edu-study/_run-flashcards.sh &
bash vibes/edu-study/_run-quizzes.sh &
```

- [ ] **Step 2: Monitor status (poll every 45 seconds)**

```bash
tail -F vibes/edu-study/_status-flashcards.log vibes/edu-study/_status-quizzes.log
```

Wait until all 6 `DONE <slug> exit=0` lines appear and both `ALL DONE` lines appear.

If any `exit=1` line appears, check that app's log file (e.g. `vibes/edu-study/pop-quote-flip.log`) for the error. If it's a stuck-state failure, re-run with a fresh slug:

```bash
# Example re-run for a failed app:
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
"$TSX" "$MAIN" generate --user-slug og --app-slug <new-seo-slug> "<same prompt>" > vibes/edu-study/<new-slug>.log 2>&1
```

Then update the slug in the corresponding `.hbs` file.

---

## Task 9 — Verify all 6 deploys

Run each check. Each must show a real `fsId` (starts with `z`) and a non-empty `mountVibe` array.

- [ ] **Step 1: Verify flashcard apps**

```bash
curl -sL https://pop-quote-flip--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://vocab-deck-builder--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://exam-card-drill--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Expected pattern for each:
```
registerDependencies({…,"fsId":"z<CID>"}) … mountVibe([V1], …)
```

- [ ] **Step 2: Verify quiz apps**

```bash
curl -sL https://what-type-quiz--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://topic-knowledge-check--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://timed-exam-practice--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Same expected pattern. If any shows `"fsId":"pending"` or empty `mountVibe([])`, that app needs a re-deploy with a fresh slug (see Task 8, Step 2).

---

## Task 10 — Mark apps live

- [ ] **Step 1: Set `"live": true` for all 3 flashcard apps in `flashcards.hbs`**

In `src/pages/edu/study/flashcards.hbs`, change every `"live": false` to `"live": true`:

```json
"live": true,
```

(Three occurrences: pop-quote-flip, vocab-deck-builder, exam-card-drill.)

- [ ] **Step 2: Set `"live": true` for all 3 quiz apps in `quizzes.hbs`**

In `src/pages/edu/study/quizzes.hbs`, change every `"live": false` to `"live": true`:

```json
"live": true,
```

(Three occurrences: what-type-quiz, topic-knowledge-check, timed-exam-practice.)

---

## Task 11 — Final build and visual verify

- [ ] **Step 1: Build**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 2: Open both pages**

```bash
open _site/edu/study/flashcards.html
open _site/edu/study/quizzes.html
```

Verify for each page:
- All 3 app cards show screenshots (or fallback og-preview.png)
- Open / Clone / Remix buttons visible
- Rung badges show TOY / MID / KEY filled in accent color
- Footer links work (cross-links between pages)

- [ ] **Step 3: Spot-check a screenshot**

For one app per page, check screenshot is a real image (not a stub):

```bash
curl -sI https://pop-quote-flip--og.prod-v2.vibesdiy.net/screenshot.jpg | grep -i "content-type\|content-length"
curl -sI https://what-type-quiz--og.prod-v2.vibesdiy.net/screenshot.jpg | grep -i "content-type\|content-length"
```

Expected: `Content-Type: image/jpeg` and `Content-Length` > 5000.

- [ ] **Step 4: Commit**

```bash
git add src/pages/edu/study/flashcards.hbs src/pages/edu/study/quizzes.hbs
git commit -m "feat: mark all 6 edu/study apps live"
```

---

## Task 12 — Add index.hbs cards and final commit

**Files:**
- Modify: `src/pages/index.hbs`

- [ ] **Step 1: Add two collection cards to index.hbs**

Find the block starting with `<a href="college.html" class="collection-card cc-acid">` and insert the following two cards **before** it:

```html
            <a href="edu/study/flashcards.html" class="collection-card cc-signal">
                <div class="collection-card-accent"></div>
                <div class="collection-card-body">
                    <div class="collection-card-top">
                        <div class="collection-card-icon">⇄</div>
                        <span class="collection-badge">3 apps live</span>
                    </div>
                    <h2>Flashcard Decks</h2>
                    <p>Party quotes, vocab builder, exam drill. Same flip-deck engine on a toy-to-key ladder. Any topic, one generation call.</p>
                    <span class="collection-cta">Start Studying →</span>
                </div>
            </a>

            <a href="edu/study/quizzes.html" class="collection-card cc-bluey">
                <div class="collection-card-accent"></div>
                <div class="collection-card-body">
                    <div class="collection-card-top">
                        <div class="collection-card-icon">?</div>
                        <span class="collection-badge">3 apps live</span>
                    </div>
                    <h2>Quiz Apps</h2>
                    <p>Personality reveal, knowledge check, timed practice exam. Same multiple-choice engine, three rungs of stakes.</p>
                    <span class="collection-cta">Test Yourself →</span>
                </div>
            </a>

```

- [ ] **Step 2: Build and verify index**

```bash
pnpm check
open _site/index.html
```

Verify: two new cards appear in the collection grid, links point to correct pages.

- [ ] **Step 3: Run prettier on modified non-hbs files**

No non-hbs files were modified (index.hbs is excluded from prettier per `.prettierignore`). Verify:

```bash
npx prettier --check "src/**/*.js" "*.js" 2>/dev/null || true
```

- [ ] **Step 4: Final commit**

```bash
git add src/pages/index.hbs vibes/edu-study/_run-flashcards.sh vibes/edu-study/_run-quizzes.sh
git commit -m "feat: add edu/study flashcard + quiz pages with 6 live apps, wire into index"
```

- [ ] **Step 5: Done signal**

```bash
echo 'study ladder live' | say
```
