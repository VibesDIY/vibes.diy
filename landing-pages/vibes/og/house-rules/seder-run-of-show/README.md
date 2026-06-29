# seder-run-of-show

> Build a single-file React app for hosting a holiday meal as a stage-managed run-of-show checklist (Seder, Thanksgiving, Christmas Eve). Use useFireproof from use-fireproof so the host and helpers see the same plan in real time, and so the layout can be saved as a reusable template for next year. Input surface: add ordered steps (time, action, who, notes — e.g. '5:45 start the brisket — Mom', '6:30 Karen reads the four questions'). Saved doc shape: { type: 'show', _id, name, steps: [{order, time, action, who, notes, done}], templateOf, createdAt }. Visible UI: a vertical timeline with checkboxes, drag-to-reorder steps, a 'who's up next' highlight banner, and a 'save as template' button at the top to clone the layout for next year's holiday. Tone: warm calm host-mode clipboard, gentle but precise.

Live at [https://vibes.diy/vibe/og/seder-run-of-show](https://vibes.diy/vibe/og/seder-run-of-show)

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
