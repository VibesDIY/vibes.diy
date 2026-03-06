# CLI tools: `npx use-vibes` and `npm create vibe`

Two npm packages. No localhost. Cloud-first. Agent-native.

## Agent Workflow

Any AI agent can go from zero to deployed app:

```bash
use-vibes slices                           # read slice catalog (fireproof, d3, etc.)
use-vibes system --slices fireproof,d3     # get assembled system prompt
use-vibes edit "build a sales dashboard"   # AI-generate App.jsx
use-vibes dev                              # push to dev, get HTTPS URL
use-vibes publish demo                     # freeze snapshot for sharing
```

The agent picks slices, gets the system prompt, generates code, and deploys — all from stdout/stdin. The URL is immediately shareable: paste it in a PR, Slack, or pass to another agent for verification.

## Human Workflow

```bash
npm create vibe "coffee ordering app"   # scaffold + AI-generate App.jsx
cd coffee-order
use-vibes login                         # authenticate once
use-vibes dev                           # live-push to your dev group
use-vibes edit "add a dark mode toggle" # AI-edit, auto-pushes via live
use-vibes publish work-lunch            # snapshot to a stable group URL
use-vibes invite work-lunch             # share a join link
```

## Packages

| Package | Install | Purpose |
|---|---|---|
| `create-vibe` | `npm create vibe` | One-shot scaffolder (with AI generation) |
| `use-vibes` | `npm i -D use-vibes` | Library + CLI: `slices`, `system`, `edit`, `live`, `publish`, `invite`, `login`, `whoami` |

## Key Concepts

- **Agent-native**: `slices → system → edit → live/publish` — designed for AI agents, not just humans
- **Target** = `owner/app/group` (e.g., `jchris/coffee-order/work-lunch`)
- **Owner** defaults to `use-vibes whoami` result
- **App** comes from `vibes.json`
- **Group** is the audience: `dev`, `work-lunch`, `family-reunion`, etc.
- `use-vibes dev` is sugar for `use-vibes live dev`
- `live` = continuous file-watch push. `edit` = AI rewrite. `publish` = one-time snapshot.
- `edit` + `live` = full AI dev loop (edit writes file, live pushes it)
- `slices` = list RAG slices for LLM decision-making. `system` = emit assembled system prompt.
- Every environment is a cloud deploy with HTTPS. No local server.

## Docs

- [cli-design.md](cli-design.md) — Full architecture: domain model, targets, vibes.json, commands
- [cli-parts.md](cli-parts.md) — Existing repo infrastructure reusable for the CLI
- [code-mvp.md](code-mvp.md) — Task list with CLI section (L0-L5)
