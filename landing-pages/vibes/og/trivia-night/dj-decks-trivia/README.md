# dj-decks-trivia

> Live multi-team trivia night app.

LANDING: two big buttons, HOST or JOIN.

HOST flow: pick a game name, app generates a 4-letter join code and shows a big QR pointing at the join URL (with code prefilled). Host manages a deck of questions; each question has a prompt, 4 options, and one correct option index. Buttons: "Next Question" reveals it to all joined phones; "Show Answer" reveals correctness and updates scores. Include an AI button: "Generate 10 questions about <topic>" using callAI with a schema returning {questions: [{prompt, options:[string,string,string,string], correctIndex:int}]}.

JOIN flow: enter the 4-letter code and a team name. When host reveals a question, every joined phone shows the prompt with a 20-second countdown synchronized via Fireproof useLiveQuery (compute remaining time from a revealAt timestamp on the game doc). Tap an option; locked when timer ends. After host taps Show Answer, every phone reveals which option was right and updates the leaderboard live.

PERSIST in Fireproof: game doc (code, name, currentQuestionId, revealAt, status), question docs, team docs (name, score), answer docs (teamId, questionId, optionIndex). Use useLiveQuery for synchronization across host and joiners.

STYLE: After-hours club poster — near-black background, electric magenta + cyan accents, monospace + chunky display type (Space Grotesk and JetBrains Mono), VU-meter style countdown bar, slight CRT scanline overlay on the question card, glitch-shift transform on answer reveal.

Live at [https://vibes.diy/vibe/jchris/dj-decks-trivia](https://vibes.diy/vibe/jchris/dj-decks-trivia)

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
