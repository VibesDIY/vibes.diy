## CLI Quickstart

### Deploy workflow

1. Run `npx vibes-diy system` to get the coding rules
2. Write `App.jsx` following the rules above
3. Run `npx vibes-diy push` to deploy — prints a live HTTPS URL
4. Edit and push again to iterate

### Other Commands

- `npx vibes-diy push --instant-join` — deploy and auto-accept sharing so anyone with the link can use it
- `npx vibes-diy push --app-slug other-name` — deploy to a different app slug instead of the directory name
- `npx vibes-diy login` — authenticate this device (run once before first push)
- `npx vibes-diy help` — show all available commands
