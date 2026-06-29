# gift-list-memory

> Build a single-file React app for tracking holiday gifts year over year. Use useFireproof from use-fireproof to sync the family gift archive across phones. Input surface: add a person (name, relation), then for each year add the gift you gave them with notes; on save, the app checks for near-duplicates from prior years and warns 'you almost gave Aunt Linda the same scarf you gave her in 2023'. Saved doc shape: { type: 'gift', _id, personName, year, gift, notes, createdAt } and { type: 'person', name, relation }. Visible UI: a left rail of people, a main panel showing one row per person with year columns (2022, 2023, 2024, 2025) each filled with the gift; an add-gift form at bottom with duplicate warning; a 'flag duplicates' toggle. Tone: cozy gentle reminder, soft ledger book vibe.

Live at [https://vibes.diy/vibe/og/gift-list-memory](https://vibes.diy/vibe/og/gift-list-memory)

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
