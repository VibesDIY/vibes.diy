# create-vibe — scaffolder for the vibes CLI

## What it does

`npm create vibe my-app` scaffolds a project directory with everything needed for the `use-vibes` CLI:

```
npm create vibe my-app
cd my-app
npm install
npm run use-vibes dev
```

Lives in the monorepo at `create-vibe/pkg/`. CI publishes via `create-vibe@*` tags. Current release: `create-vibe@1.4.0-dev`.

### What `create-vibe my-app` produces

```
my-app/
├── package.json     ← use-vibes as devDep, single "use-vibes" script
├── app.jsx          ← your vibe (placeholder, Claude-ready)
└── vibes.json       ← app identity ({ "app": "my-app" })
```

The `package.json` has one script — `"use-vibes": "use-vibes"` — so all CLI commands work via `npm run use-vibes <subcommand>` (e.g. `npm run use-vibes system`, `npm run use-vibes skills`).

Extra files are fine: import them from app.jsx and ESM resolution handles it. But the default is one file.

### One directory = one vibe

Each `create-vibe` invocation makes a new project directory. Want three vibes? Run it three times:

```
~/vibes/
├── todo/           ← npm create vibe todo
│   ├── package.json
│   ├── app.jsx
│   └── vibes.json
├── meal-plan/      ← npm create vibe meal-plan
│   ├── package.json
│   ├── app.jsx
│   └── vibes.json
└── budget/         ← npm create vibe budget
    ├── package.json
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
npm create vibe todo                    → scaffold directory with package.json + vibes.json + app.jsx
cd todo && npm install                  → install use-vibes as devDep
npm run use-vibes system                → get the system prompt for writing app.jsx
npm run use-vibes dev                   → watch → push on save → print live URL (future)
npm run use-vibes publish               → one-time push to production group (future)
```

`create-vibe` owns scaffolding. `use-vibes edit` handles AI iteration on existing code (future). `use-vibes generate` is a signpost pointing back to create-vibe.

## Two user journeys

**Interactive (human):**
```
npm create vibe my-app       ← asks project name, writes placeholder app.jsx
cd my-app && npm install
# edit app.jsx (or have Claude write it using npm run use-vibes system)
npm run use-vibes dev        ← opens live URL, watches for changes
npm run use-vibes publish    ← deploy to production
```

**Automated (agent):**
```
npm create vibe todo
cd todo && npm install
npm run use-vibes system     ← agent reads the system prompt
# agent writes app.jsx
npm run use-vibes publish
# stdout: https://vibes.diy/jchris/todo
```

The scaffold is Claude-ready — agents use `npm run use-vibes system` to get the system prompt, then write app.jsx themselves. See [golden-path-prompt.md](golden-path-prompt.md) for a tested prompt.

## Relationship to eject-vibe

[VibesDIY/eject-vibe](https://github.com/VibesDIY/eject-vibe) is the escape hatch: a full Vite+React+Tailwind project for when users want to leave the platform. Different tool, different moment:

| | create-vibe | eject-vibe |
|---|---|---|
| **Creates** | `package.json` + `app.jsx` + `vibes.json` | Full Vite project |
| **Runtime** | `npm run use-vibes dev` (cloud) | `npm run dev` (localhost) |
| **Deploy** | `npm run use-vibes publish` | User manages (Netlify, etc.) |
| **Dependencies** | `use-vibes` as devDep | Full node_modules |

## Current state

Dry scaffold shipped in `create-vibe@1.4.0-dev`:
- `npm create vibe todo` → creates `todo/package.json` + `todo/vibes.json` + `todo/app.jsx`
- `package.json` has `use-vibes` as devDep with single `"use-vibes": "use-vibes"` script
- Interactive name prompt if no arg given
- No AI generation — scaffold is Claude-ready (user brings their own AI)
- Golden path tested end-to-end: scaffold → install → system prompt → write app.jsx

## Future: optional prompt → AI generation

`npm create vibe todo "a collaborative todo list"` could AI-generate `app.jsx` instead of the placeholder. Requires:
- `call-ai` as a dependency (Node 20+ compatible, already in monorepo)
- `@vibes.diy/prompts` for `makeBaseSystemPrompt` (same pattern as `use-vibes system`)
- `OPENROUTER_API_KEY` env var — falls back to placeholder if missing
