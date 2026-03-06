# CLI tools: `npx use-vibes` and `npm create vibe`

Two npm packages. No localhost. Cloud-first.

## Quick Start

```bash
npm create vibe "coffee ordering app"   # scaffold + AI-generate App.jsx
cd coffee-order
use-vibes login                         # authenticate once
use-vibes dev                           # live-push to your dev group
use-vibes edit "add a dark mode toggle" # AI-edit App.jsx, auto-pushes via live
use-vibes publish work-lunch            # snapshot to a stable group URL
use-vibes invite work-lunch             # share a join link
```

## Packages

| Package | Install | Purpose |
|---|---|---|
| `create-vibe` | `npm create vibe` | One-shot scaffolder (with AI generation) |
| `use-vibes` | `npm i -D use-vibes` | Library + CLI: `live`, `edit`, `system`, `publish`, `invite`, `login`, `whoami` |

## Key Concepts

- **Target** = `owner/app/group` (e.g., `jchris/coffee-order/work-lunch`)
- **Owner** defaults to `use-vibes whoami` result
- **App** comes from `vibes.json`
- **Group** is the audience: `dev`, `work-lunch`, `family-reunion`, etc.
- `use-vibes dev` is sugar for `use-vibes live dev`
- `live` = continuous file-watch push. `edit` = AI rewrite. `publish` = one-time snapshot.
- `edit` + `live` = full AI dev loop (edit writes file, live pushes it)
- `system` = emit assembled system prompt for BYO-token workflows (select RAG slices)
- Every environment is a cloud deploy with HTTPS. No local server.

## Docs

- [cli-design.md](cli-design.md) — Full architecture: domain model, targets, vibes.json, commands
- [cli-parts.md](cli-parts.md) — Existing repo infrastructure reusable for the CLI
- [code-mvp.md](code-mvp.md) — Task list with CLI section (L0-L5)
