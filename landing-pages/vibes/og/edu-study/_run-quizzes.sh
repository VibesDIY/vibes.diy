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
