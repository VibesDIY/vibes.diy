# holiday-card-roster

> Build a single-file React app for managing a holiday card mailing list. Use useFireproof from use-fireproof to sync the address book between you and your spouse. Input surface: quick-add form (name, address, relation) plus per-year status toggles for sent / received / skipped. Saved doc shape: { type: 'recipient', _id, name, address, relation, history: { '2023': 'sent', '2024': 'received', '2025': 'skipped' }, createdAt }. Visible UI: a sortable table — name, address, then one column per year showing colored chips (green sent, blue received, gray skipped); a 'quick add' inline row at the bottom; an export view that prints a clean address-label sheet. Tone: warm stationary-drawer practical, like a recipe-card box for stamps and good intentions.

Live at [https://vibes.diy/vibe/og/holiday-card-roster](https://vibes.diy/vibe/og/holiday-card-roster)

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
