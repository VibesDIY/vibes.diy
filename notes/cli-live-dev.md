# CLI Live Dev: Zero-Build, Live-by-Default

Turns `npm create vibe` into "push-button app substrate." Deploy is save.

## Packages

### `create-vibe` (scaffold)

Used via: `npm create vibe@latest`

Generates:
- `app.jsx` (or `app.tsx`) — the single-file vibe
- `vibes.json` — app identity + pointers (dev/live) + optional channel binding
- `package.json` — scripts wired to CLI
- eslint config + minimal test harness

No bundler. No Vite. No local web server required.

### `use-vibes` (SDK / runtime contract)

Installed into generated projects. Provides:
- Data / auth / sharing client helpers
- Types + contract utilities (what a vibe app is allowed to do)
- React hooks (`useVibes()`, `useFireproof()`, `callAI()`)

### `@vibes.diy/cli` (dev dependency)

Scripts call the CLI; users don't need to install anything globally.

## The UX

### `npm run dev`

First run:
- Prompts login (device-code flow)
- Creates a new app record (or reuses existing)
- Prints a live URL

On every save:
- Runs lint (fast, cached)
- If lint passes: upload new version, URL updates instantly
- If lint fails: do not deploy (keep last good version live)
- Prints diff-ish error summary + file/line

### `npm run publish`

- Promote latest clean dev build to live pointer
- Print live URL

### `npm run share`

- Generate instant join link for the published (live) version
- Only works if there is a published version

### `npm start`

- Open/run the published app (live URL) or show status

## What `vibes dev` actually does

One command is the whole experience.

Responsibilities:
- Watch files (app.jsx, assets, config)
- Debounce changes (300-500ms)
- Run eslint (and optional typecheck)
- If OK → push (atomic)
- Print: URL, current deployed version hash, last deploy time
- Optionally auto-open browser

Atomic deploy matters: upload as "candidate," validate server-side, then flip pointer.

## Live Deploy URL Semantics

Give the user a stable URL immediately, even before first successful upload:
- `https://<slug>.vibes.diy/` (stable)
- Runtime loads "latest good version"
- `vibes dev` updates that pointer when lint passes

Instant feedback without manual refresh:
- Simplest: runtime polls "version pointer" every few seconds
- Nicer: SSE/WebSocket "new version available → reload"

## Sharing Integration

Default dev experience is private but ready.

`vibes.json` supports:
- `channel` — optional, bind to an existing group
- `cloneAccessFrom` — optional, inherit sharing rules from another app

Console handles invites/join links, but CLI can expose shortcuts:
- `vibes joinlink` — prints a link
- `vibes clone-access <app>` — binds to same sharing group

## `vibes ai "<instruction>"`

AI edits with app.jsx as the single source of truth. Only writes back clean, contract-valid code.

### What it does

1. Reads `app.jsx`
2. Sends (instruction + current code + contract rules) to the model
3. Applies a patch to `app.jsx`
4. Runs lint (and optional tests)
5. If clean: in dev mode, triggers the normal dev deploy loop
6. If not clean: keeps changes in a local patch file and prints errors

### Safety rules

- Never touches the live version (only affects dev unless you publish)
- Writes only to `app.jsx` (+ optional `vibes.json` if config change needed)
- Requires lint/type pass to "commit" the change
- Keeps an undo trail: `vibes undo` reverts last AI edit

### Multi-candidate mode (agent-friendly)

```
vibes ai --n 4 --iters 2 "make it responsive"
```

- Writes candidates to `./candidates/app.<id>.jsx`
- You choose one: `vibes pick <id>`
- Matches the "100 variants/min" story without risking overwrites

## Generated package.json

```json
{
  "name": "my-vibe",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vibes dev",
    "publish": "vibes publish",
    "share": "vibes share --published",
    "start": "vibes open --published",
    "test": "npm run lint && npm run unit",
    "lint": "eslint .",
    "unit": "node --test",
    "ai": "vibes ai"
  },
  "dependencies": {
    "use-vibes": "^0.1.0"
  },
  "devDependencies": {
    "@vibes.diy/cli": "^0.1.0",
    "eslint": "^9.0.0"
  }
}
```

Usage:
- `npm run dev` — watch + lint + push dev pointer
- `npm run publish` — promote dev to live (atomic)
- `npm run share` — mint instant join link for live
- `npm start` — open live URL
- `npm run ai -- "retheme to memphis"`
- `npm run ai -- --n 4 "make the list sortable"`

## vibes.json

App identity and pointers. Created by `create-vibe`, read by CLI and `use-vibes`.

```json
{
  "name": "my-vibe",
  "slug": "fuzzy-purple-app",
  "owner": "alice",
  "pointers": {
    "dev": null,
    "live": null
  },
  "channel": null,
  "cloneAccessFrom": null
}
```

- `slug` / `owner` — immutable after creation
- `pointers.dev` — updated on every successful `vibes dev` push
- `pointers.live` — updated only on `vibes publish`
- `channel` — optional, bind to an existing sharing group
- `cloneAccessFrom` — optional, inherit sharing rules from another app

## CLI Commands Behind the Scripts

| Command | What it does |
|---------|-------------|
| `vibes dev` | Watch + lint gate + push dev pointer |
| `vibes publish` | Promote dev → live (atomic) |
| `vibes share --published` | Mint instant join link for live |
| `vibes open --published` | Open live URL (or print it) |
| `vibes ai "<instruction>"` | AI edit → lint gate → dev deploy |

## Why This Wins

- Runtime contract becomes the default dev loop
- New users experience deploy as save
- Platform becomes the fastest path to a real, shareable app
- REAL escape hatch still holds (it's just JS/TS + a thin adapter)

## Sharp Edges to Get Right

### Don't deploy broken states
Keep "last good version" live. Treat lint/type errors as local-only state. The URL always works.

### Cost + rate control
Debounce, batch, and upload diffs (or single-file) so "save spam" doesn't hammer the backend.
