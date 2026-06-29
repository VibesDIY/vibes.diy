# element-quiz-table

> Periodic table quiz game — a quiz-first take on the periodic table. The student starts on a config screen choosing quiz mode: "Find by name", "Find by symbol", "Find by number", or "Mixed" — and difficulty (first 20 elements, first 36, or all 118). Click "Start" to enter quiz mode: render the periodic table with all element labels HIDDEN (just empty colored cells in correct positions). The app shows a prompt at the top like "Click Iron (Fe)" or "Click element 26" or just "Click Cl". The student clicks a cell; if correct, the cell reveals its label and turns green; if wrong, it briefly flashes red and the prompt repeats. After 10 questions, show a results screen with score, time, and a per-question breakdown. Save each session as a Fireproof doc with date, score, mode, difficulty, and time. List past sessions on the home screen with personal-best highlighting. The non-quiz "study mode" button shows the full labeled table for review with click-to-see-details. Hard-code the periodic table layout and element data for at least the first 36 elements. Single-file React. Tone: educational game, encouraging feedback, scoreboard aesthetic.

Live at [https://vibes.diy/vibe/jchris/element-quiz-table](https://vibes.diy/vibe/jchris/element-quiz-table)

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
