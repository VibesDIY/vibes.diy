# pet-med-tracker

> Pet medication and vet tracker. Add pets and their medications (name, dose, frequency: daily/weekly/as-needed). Each med shows next-due time and a 'mark given' button that logs the dose with timestamp. Separate tab for vet visits and vaccinations with date and notes. Upcoming reminders banner at top for anything due today. Fireproof for sync. No images.

Live at [https://vibes.diy/vibe/jchris/pet-med-tracker](https://vibes.diy/vibe/jchris/pet-med-tracker)

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
