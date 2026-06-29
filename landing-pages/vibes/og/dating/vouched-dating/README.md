# vouched-dating

> Sponsored-entry dating. You can't sign up — an existing user nominates you. They stake reputation; bad behavior costs them visibility too. Every match shows 'introduced by [name], who has vouched for 7 others, all still active.' Trust-graph pool. Save in Fireproof.

Live at [https://vibes.diy/vibe/og/vouched-dating](https://vibes.diy/vibe/og/vouched-dating)

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
