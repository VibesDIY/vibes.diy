# li-profile-roaster

> Parody LinkedIn profile generator from select-all paste. User pastes the raw text of any LinkedIn profile (select-all + copy). App extracts name, headline, current role, and uses AI to generate a parody "thought leader" version of the profile with absurd accomplishments. Save profiles as Fireproof docs and list them. No actual images, just a placeholder avatar circle with initials.

Live at [https://vibes.diy/vibe/jchris/li-profile-roaster](https://vibes.diy/vibe/jchris/li-profile-roaster)

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
