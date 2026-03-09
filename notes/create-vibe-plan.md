# create-vibe — scaffolder for the vibes CLI

## What it does today

`npm create vibe` (or `npx create-vibe`) asks "What do you want to build?" and opens `vibes.diy?prompt=...` in the browser. That's it — a URL launcher.

Now lives in the monorepo at `create-vibe/pkg/`. CI publishes via `create-vibe@*` tags.

## Where it's going

The scaffolder creates a minimal project directory that the `use-vibes` CLI can work with:

```
npm create vibe my-app
cd my-app
use-vibes dev
```

### What `create-vibe my-app` produces

```
my-app/
├── app.jsx          ← your vibe (AI-generated or placeholder)
└── vibes.json       ← app identity + deploy targets
```

That's it. No package.json, no node_modules, no build config. The `use-vibes` CLI provides the runtime — `app.jsx` is the entire app.

Extra files are fine: import them from app.jsx and ESM resolution handles it. But the default is one file.

### One directory = one vibe

Each `create-vibe` invocation makes a new project directory. Want three vibes? Run it three times:

```
~/vibes/
├── todo/           ← npm create vibe todo "collaborative todo list"
│   ├── app.jsx
│   └── vibes.json
├── meal-plan/      ← npm create vibe meal-plan "weekly meal planner"
│   ├── app.jsx
│   └── vibes.json
└── budget/         ← npm create vibe budget "household budget tracker"
    ├── app.jsx
    └── vibes.json
```

Each has its own vibes.json, its own targets, its own URL. No multi-vibe config to manage.

### vibes.json

Matches the format from [cli-design.md](cli-design.md) — app identity + deploy targets:

```json
{
  "app": "todo",
  "targets": {
    "dev": {
      "fs": [{ "id": "bafyabc1", "ts": "2026-03-09T12:00:00Z" }]
    }
  }
}
```

- **`app`** — name for target resolution (`{whoami}/{app}/{group}`)
- **`targets`** — local cache of deploy history per group (advisory, server is truth)
- `live` replaces its single `fs` entry on each push; `publish` appends history

See [cli-design.md](cli-design.md) for the full schema including invite permissions and target resolution rules.

## How it connects to the CLI

```
create-vibe todo               → scaffold directory + vibes.json + placeholder app.jsx
cd todo
use-vibes edit "add dark mode" → AI-edit app.jsx in place (future)
use-vibes dev                  → watch → push on save → print live URL
use-vibes publish              → one-time push to production group
```

`create-vibe` owns AI generation at scaffold time. `use-vibes edit` handles AI iteration on existing code. `use-vibes generate` is a signpost:

```
$ use-vibes generate
To create a new vibe:
  cd .. && npm create vibe my-app "describe what you want"
```

## Two user journeys

**Interactive (human):**
```
npm create vibe my-app       ← asks project name, writes placeholder app.jsx
cd my-app
# edit app.jsx (or have Claude write it)
use-vibes dev                ← opens live URL, watches for changes
use-vibes publish            ← deploy to production
```

**Automated (agent):**
```
npm create vibe todo
cd todo
# agent writes app.jsx using use-vibes system prompt
use-vibes publish
# stdout: https://vibes.diy/jchris/todo
```

The scaffold is Claude-ready — agents use `use-vibes system` to get the system prompt, then write app.jsx themselves.

## Relationship to eject-vibe

[VibesDIY/eject-vibe](https://github.com/VibesDIY/eject-vibe) is the escape hatch: a full Vite+React+Tailwind project for when users want to leave the platform. Different tool, different moment:

| | create-vibe | eject-vibe |
|---|---|---|
| **Creates** | `app.jsx` + `vibes.json` | Full Vite project |
| **Runtime** | `use-vibes dev` (cloud) | `npm run dev` (localhost) |
| **Deploy** | `use-vibes publish` | User manages (Netlify, etc.) |
| **Dependencies** | None (CLI provides everything) | node_modules |

## Current state

Dry scaffold shipped in `create-vibe@1.2.0-dev`:
- `npm create vibe todo` → creates `todo/vibes.json` + `todo/app.jsx` (placeholder)
- Interactive name prompt if no arg given
- No AI generation yet — scaffold is Claude-ready (user brings their own AI)

## Future: optional prompt → AI generation

`npm create vibe todo "a collaborative todo list"` could AI-generate `app.jsx` instead of the placeholder. Requires:
- `call-ai` as a dependency (Node 20+ compatible, already in monorepo)
- `@vibes.diy/prompts` for `makeBaseSystemPrompt` (same pattern as `use-vibes system`)
- `OPENROUTER_API_KEY` env var — falls back to placeholder if missing
