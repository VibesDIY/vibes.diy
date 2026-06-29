# Design: edu/study — Quiz & Flashcard Pages

**Date:** 2026-05-19
**URLs:** `good.vibes.diy/edu/study/flashcards` · `good.vibes.diy/edu/study/quizzes`
**Files:** `src/pages/edu/study/flashcards.hbs` · `src/pages/edu/study/quizzes.hbs`
**Vibes:** `vibes/edu-study/`

---

## Concept

Two sibling pages under the `/edu/study/` cluster, each showcasing a different learning primitive through a toy-to-key progression of three apps. Both pages are `layout: "webring"` with self-contained CSS — same pattern as `trivia.hbs` and `college.hbs`.

---

## The Six Apps

### Flashcard ladder (`flashcards.hbs`)

| Rung | Slug | Title | Tagline |
|------|------|-------|---------|
| Toy  | `pop-quote-flip` | Quote Flip | Guess the character. Flip the card. |
| Mid  | `vocab-deck-builder` | Vocab Deck | Type a topic, get a study deck. |
| Key  | `exam-card-drill` | Exam Drill | Confidence-rated cards for high-stakes prep. |

### Quiz ladder (`quizzes.hbs`)

| Rung | Slug | Title | Tagline |
|------|------|-------|---------|
| Toy  | `what-type-quiz` | What Type Are You? | Personality quiz with a shareable result card. |
| Mid  | `topic-knowledge-check` | Knowledge Check | AI-generated 10-question quiz on any topic. |
| Key  | `timed-exam-practice` | Exam Practice | Timed practice exam with section scoring and pass/fail. |

All six apps deploy under `--user-slug=og`.

---

## Primitives

### Flashcard primitive

Every flashcard app shares this engine:

- **Deck generation:** user types a topic → `callAI` returns `{cards: [{front: string, back: string}]}` (10–20 cards)
- **Manual add:** form to add individual front/back cards
- **Study mode:** one card at a time, flip animation (CSS transform), two buttons: **Known** / **Still Learning**
- **Session stats:** progress bar, % known, cards remaining
- **Persist:** Fireproof deck doc + card docs + per-session progress doc; `useLiveQuery` for reactive updates
- **Reset:** restart session, shuffle deck

Each rung adjusts tone and context, not mechanics:
- `pop-quote-flip`: pre-seeded with pop-culture quote prompts; social/party framing
- `vocab-deck-builder`: clean study framing; supports topic like "Spanish verbs" or "cell biology"
- `exam-card-drill`: adds a third button **Not Sure** (3-level confidence); shows cards marked Not Sure more often; exam-prep framing

### Quiz primitive

Every quiz app shares this engine:

- **Quiz generation:** user types a topic → `callAI` returns `{questions: [{prompt: string, options: [string,string,string,string], correctIndex: number}]}`
- **One question at a time:** multiple choice, 4 options
- **Optional timer:** 30-second countdown per question (progress bar)
- **Score screen:** right/wrong per question, overall %, retry button
- **Persist:** Fireproof quiz doc + question docs + attempt docs
- **Review mode:** after scoring, step through each question to see correct answer

Each rung adjusts mechanics:
- `what-type-quiz`: no correct answer — each option maps to an archetype; end screen reveals archetype + description; shareable result text
- `topic-knowledge-check`: standard scored quiz; AI generates 10 questions; retry with new AI questions
- `timed-exam-practice`: 20-question timed quiz; questions grouped into 2–3 sections (AI assigns); section-by-section score breakdown; configurable pass threshold (default 70%); shows pass/fail verdict

---

## Visual Skins

### `flashcards.hbs` — Study Stack

- **Background:** warm cream `oklch(0.97 0.02 80)` with subtle dot-grid (`radial-gradient` 1px dots at 24px intervals)
- **Accent:** terracotta `oklch(0.72 0.18 40)`
- **Fonts:** `Crimson Pro` (serif, card fronts and headings) + `Inter` (UI chrome)
- **Cards:** cream with 2px black border, 4px offset shadow in terracotta; flip animation via `rotateY(180deg)`
- **Ladder badges:** `TOY` / `MID` / `KEY` in small mono caps, accent background on active rung
- **vibe:** index cards fanned on a wooden desk

### `quizzes.hbs` — Answer Sheet

- **Background:** cool off-white `oklch(0.96 0.005 240)` with hairline horizontal rules (repeating-linear-gradient)
- **Accent:** electric blue `oklch(0.58 0.22 250)`
- **Fonts:** `Space Grotesk` (headings) + `Inter` (body)
- **Cards:** white background, 2px black border, clean no-offset shadow; option buttons highlight blue on selection
- **Ladder badges:** `TOY` / `MID` / `KEY` in mono, blue fill on current rung
- **vibe:** standardized test answer sheet, but not austere — confident and energetic

---

## Page Structure

Both pages use `layout: "webring"` and bring their own full HTML+CSS. Section order per page:

1. **Topbar** — `VIBES DIY` wordmark left, `EDU / STUDY` breadcrumb right
2. **Hero** — cluster title (`FLASHCARD DECKS` or `QUIZ APPS`), one-line subtext, ladder concept label
3. **Ladder label strip** — three `TOY · MID · KEY` rung labels, visually positioned above the app grid
4. **App grid** — 3 app cards in a horizontal row (or stacked on mobile); each card shows screenshot, title, tagline, desc, Join/Clone links
5. **CTA** — "Build your own deck/quiz at Vibes DIY" → `https://links.vibes.diy/homepage`
6. **Footer** — minimal, social links

---

## File Layout

```
src/pages/edu/study/
  flashcards.hbs
  quizzes.hbs

vibes/edu-study/
  _run-flashcards.sh
  _run-quizzes.sh
  pop-quote-flip/          (App.jsx, README.md after generate)
  vocab-deck-builder/
  exam-card-drill/
  what-type-quiz/
  topic-knowledge-check/
  timed-exam-practice/
```

---

## Generation Scripts

`_run-flashcards.sh` and `_run-quizzes.sh` follow the standard batch pattern: one `gen()` function per app, backgrounded, status written to `_status.log`. All calls pin `--user-slug=og`.

Prompt structure per app: core primitive spec (shared) + rung-specific tone/mechanic additions + visual style paragraph. Prompts target 500–700 words each (detailed spec range).

---

## Verification Checklist (per app)

Before marking `live: true` in the frontmatter:

```sh
curl -sL https://<slug>--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
# Must show real fsId (z...) and non-empty mountVibe array
```

---

## Index Wiring

After both pages build successfully, add two cards to `src/pages/index.hbs` under a new `EDU` group (or alongside existing themed cards). Each card links to the respective `/edu/study/` page.
