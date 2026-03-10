# use-vibes

CLI and runtime for building and deploying React + Fireproof apps on [vibes.diy](https://vibes.diy).

## Quick start

```bash
npm create vibe my-app
cd my-app
npm install
```

## CLI commands

All commands run via `npm run use-vibes <command>`:

| Command | Description |
|---------|-------------|
| `skills` | List available skill libraries (fireproof, callai, web-audio, d3, three-js, image-gen) |
| `system --skills fireproof,d3` | Emit the full system prompt for selected skills |
| `login` | Authenticate with vibes.diy |
| `whoami` | Print the logged-in user |
| `handle register [slug]` | Register a new handle (or auto-generate one) |
| `dev` | Watch files and push on save (coming soon) |
| `publish` | One-time push to production (coming soon) |

## Writing app.jsx

Use the system prompt to guide AI or hand-write your vibe:

```bash
npm run use-vibes skills                           # browse available skills
npm run use-vibes -- system --skills fireproof,d3  # get the system prompt
```

The system prompt tells you how to write `app.jsx` — a single React component with Tailwind CSS, Fireproof for data, and any selected skill libraries. All imports resolve automatically via esm.sh at runtime; no need to `npm install` additional packages.

## Runtime

`use-vibes` also provides React hooks and components used by vibes at runtime:

- **useFireproof** — enhanced hook with sync capabilities
- **callAI** — streaming AI API client
- **ImgGen** — image generation components

## Links

- [vibes.diy](https://vibes.diy) — build and share vibes in the browser
- [GitHub](https://github.com/nicefacer/vibes.diy) — source code
- [npm](https://www.npmjs.com/package/use-vibes) — npm package
