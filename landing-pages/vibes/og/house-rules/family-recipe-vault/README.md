# family-recipe-vault

> Build a single-file React app for collecting family recipes with optional voice-memo captures. Use useFireproof from use-fireproof to sync recipes across the family; use the Web Speech API (SpeechRecognition) to capture and transcribe spoken instructions. Input surface: a form for title, contributor, occasion tags (Thanksgiving/Hanukkah/Sunday/Birthday), ingredients list, and a 'hold to record' button that transcribes voice into the steps field. Saved doc shape: { type: 'recipe', _id, title, contributor, occasions: [], ingredients: [], steps, transcript, createdAt }. Visible UI: a left rail listing recipes grouped by occasion; a main panel showing the selected recipe with print-friendly typography; a record button with live transcription preview; tag chips for filtering. Tone: warm grandma's index-card box, generous serif, gentle browns and creams.

Live at [https://vibes.diy/vibe/og/family-recipe-vault](https://vibes.diy/vibe/og/family-recipe-vault)

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
