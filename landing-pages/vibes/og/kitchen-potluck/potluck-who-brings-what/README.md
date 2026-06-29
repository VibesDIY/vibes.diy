# potluck-who-brings-what

> Build a single-file React app called Potluck Sign-Up Board. Use Fireproof via useFireproof from 'use-fireproof' so multiple guests sharing the link see live updates instantly. The screen shows five fixed category columns: Appetizer, Main, Side, Dessert, Drink. Each column lists current claims as cards: who is bringing it (name) and what dish, plus optional dietary tags chosen from chips: Vegan, GF, Nut-free, Dairy-free. Empty columns display a subtle italic placeholder 'needs claimer' in muted grey. At the bottom of each column is a small inline form: name input, dish input, dietary chip toggles, and an 'add' button that saves a doc shaped { type:'claim', category, name, dish, diet:[], createdAt }. Each card has a tiny X to remove your claim. Use a warm friendly tone, soft cream background, hand-written serif headings, simple flat colors per category. Show a count like '12 dishes claimed' at top. No login. Mobile-friendly single screen.

Live at [https://vibes.diy/vibe/og/potluck-who-brings-what](https://vibes.diy/vibe/og/potluck-who-brings-what)

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
