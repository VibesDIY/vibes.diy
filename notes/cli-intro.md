# CLI tools: `npx use-vibes` and `npm create vibe`

Two npm packages. Instant live cloud deploys. Agent-native.

## Agent Workflow

Any AI agent can go from zero to deployed app:

```bash
use-vibes skills                           # read skill catalog (fireproof, d3, etc.)
use-vibes system --skills fireproof,d3     # get assembled system prompt for local generation
use-vibes generate my-app "build a sales dashboard"  # AI-generate my-app.jsx
use-vibes dev                              # same as `use-vibes live dev` get HTTPS URL
use-vibes publish demo                     # freeze snapshot for sharing
```

The agent picks skills, gets the system prompt, generates code, and deploys — all from stdout/stdin. The URL is immediately shareable: paste it in a PR, Slack, or pass to another agent for verification.

## Human Workflow

```bash
npm create vibe "coffee ordering app"   # scaffold + AI-generate App.jsx
cd coffee-order
use-vibes login                         # authenticate once
use-vibes dev                           # live-push to your dev group
use-vibes edit app "add a dark mode toggle" # AI-edit app.jsx, auto-pushes via live
use-vibes publish work-lunch            # snapshot to a stable group URL
use-vibes invite work-lunch             # (future) pre-approved instant access token
```

## Run CLI Today

```bash
# npm (published)
npx use-vibes --help
npx use-vibes skills

# Deno (from monorepo root)
deno task --config use-vibes/pkg/deno.json run-cli --help
deno task --config use-vibes/pkg/deno.json run-cli skills

# Deno CLI tests
deno task --config use-vibes/pkg/deno.json check-cli
deno task --config use-vibes/pkg/deno.json test-cli
```

## Packages

| Package | Install | Purpose |
|---|---|---|
| `create-vibe` | `npm create vibe` | One-shot scaffolder (with AI generation) |
| `use-vibes` | `npm i -D use-vibes` | Library + CLI: `skills`, `system`, `generate`, `edit`, `live`, `publish`, `invite`, `login`, `whoami` |

## Key Concepts

- **Agent-native**: `skills → system → generate → live/publish` — designed for AI agents, not just humans
- **Target** = `owner/app/group` (e.g., `jchris/coffee-order/work-lunch`)
- **Owner** defaults to the user's active handle (per selection precedence: `--as` → last-used → single-handle → fail; see [access-control.md](access-control.md))
- **App** comes from `vibes.json`
- **Group** is the audience: `dev`, `work-lunch`, `family-reunion`, etc.
- `use-vibes dev` is sugar for `use-vibes live dev`
- `live` = continuous file-watch push. `edit` = AI rewrite. `generate` = AI create new vibe. `publish` = one-time snapshot.
- `edit` + `live` = full AI dev loop (edit writes file, live pushes it)
- `skills` = list RAG skills for LLM decision-making. `system` = emit assembled system prompt.
- **One directory, many vibes**: each vibe gets its own `slug.jsx` file, all managed from one `vibes.json`
- Every save pushes to a live HTTPS URL instantly.

## Docs

- [mvp-web.md](mvp-web.md) — Simplest web-only path: visibility + request write access
- [mvp-cli.md](mvp-cli.md) — First steps to build the CLI (features, interface, logic)
- [mvp-invites.md](mvp-invites.md) — Visibility, access requests, permissions, group sharing model
- [cli-architecture.md](cli-architecture.md) — Implementation: Deno-first, cmd-ts, dnt, testing
- [cli-design.md](cli-design.md) — Full architecture: domain model, targets, vibes.json, commands
- [cli-parts.md](cli-parts.md) — Existing repo infrastructure reusable for the CLI
- [cli-release-process.md](cli-release-process.md) — How to tag and ship releases
- [code-mvp.md](code-mvp.md) — Task list with full tech details (L0-L5)
