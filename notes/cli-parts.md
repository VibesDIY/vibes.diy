# Existing CLI Parts Inventory

What's already in the repo that the `create-vibe` and `use-vibes` CLI packages can reuse.

---

## Existing CLI Usage: `cmd-ts`

Used across the monorepo: call-ai, build scripts, and **the `use-vibes` CLI** (adopted per Meno's PR review — see [cli-architecture.md](cli-architecture.md) for architecture details).

### call-ai/v2/cli.ts — AI streaming CLI
```bash
pnpm --filter @vibes.diy/call-ai-v2 cli --prompt "hello" --model "openai/gpt-4o-mini"
```
- Streams from OpenRouter API
- Flags: `--prompt`, `--model`, `--api-key`, `--url`
- Output modes: `--raw`, `--line`, `--data`, `--sse`, `--delta`, `--block`, `--stats`, `--image`
- Reads `.env` for `OPENROUTER_API_KEY`
- **Reusable for**: `npm create vibe "description"` AI generation path

### vibes.diy/pkg/slack/scripts/ — Build utilities
- `bundle-fs.ts` — bundle files into a single FS structure (minify, gzip, glob patterns) — uses `cmd-ts`
- `extract-imports.ts` — AST-based import extraction using Babel parser
- `get-package-version.ts` — read versions from pnpm lockfile
- `analyze-dependencies.ts` — dependency graph analysis

---

## Build System: `@fireproof/core-cli`

Root build script: `"build": "core-cli tsc"`. Used across all workspace packages for TypeScript compilation. Each package also has `"publish": "core-cli build -x '^'"` for npm publishing.

---

## ensureAppSlug API — The Deploy Endpoint

Location: `vibes.diy/api/svc/intern/ensure-slug-binding.ts`

This is the key API the CLI will call for both `live` and `publish`:
- Generates or validates user + app slugs
- Uses `random-words` for slug generation (the `animated-hypotenuse-catchphrase` part)
- Manages database bindings (UserSlugBindings, AppSlugBindings, Apps tables)
- Public handler: `vibes.diy/api/svc/public/ensure-app-slug-item.ts`

---

## API Service Structure

```
vibes.diy/api/
├── pkg/          # API package entry
├── svc/
│   ├── public/   # Public endpoints (ensure-app-slug, get-app, list, etc.)
│   ├── intern/   # Internal utilities (slug generation, etc.)
│   ├── sql/      # Drizzle ORM schema (D1/SQLite)
│   └── peers/    # External integrations (R2, S3)
├── impl/         # Implementation
└── types/        # Type definitions
```

Database tables (Drizzle ORM): Assets, UserSlugBindings, AppSlugBindings, Apps, ChatContexts, ChatSections, PromptContexts

---

## Wrangler / Cloudflare Deploy

Two wrangler configs:
- `vibes.diy/pkg/wrangler.toml` — main React Router app on Workers (D1, R2, Durable Objects, Queues)
- `hosting/pkg/wrangler.jsonc` — hosting service worker

Deploy scripts in `vibes.diy/pkg/package.json`:
```json
"deploy:dev": "react-router build && wrangler deploy"  // CLOUDFLARE_ENV=dev
"deploy:prod": "react-router build && wrangler deploy"  // CLOUDFLARE_ENV=prod
```

---

## Hosting Worker

`hosting/pkg/` is a separate Cloudflare Worker that serves published vibes:
- Scripts: `dev`, `deploy`, `preview`
- KV namespace operations (`kv:*`)
- Queue management (`queue:*`)
- Has its own `check` script (format + lint)

---

## Root Scripts (developer commands)

| Script | What it does |
|---|---|
| `pnpm dev` | React Router dev server (vibes.diy/pkg) |
| `pnpm build` | `core-cli tsc` across workspace |
| `pnpm build:prod` | Production build of vibes.diy |
| `pnpm check` | build + lint + test + hosting tests |
| `pnpm test:all` | Runs tests across all workspace packages |
| `pnpm wrangler:types` | Generate Cloudflare Worker types |
| `pnpm hosting:check` | Build + lint + test hosting packages |

---

## Key Dependencies Available

```
zx               — Shell scripting in JS (used for subprocess calls)
tsx              — Run TypeScript directly, no build step (CLI entry point)
esbuild          — Fast bundling
@babel/parser    — AST analysis
random-words     — Slug generation
drizzle-orm      — Database schema
dotenv           — .env loading
find-up          — Config file discovery
```

Note: `cmd-ts` is now used by the `use-vibes` CLI for subcommand routing, option parsing, and help generation — see [cli-architecture.md](cli-architecture.md).

---

## CI/CD Workflows

```
.github/workflows/
├── use-vibes-publish.yaml     # Tag-triggered: use-vibes@v* → publishes 5 packages (prompts, call-ai, types, base, use-vibes)
├── call-ai-publish.yaml       # Tag-triggered: call-ai@v*
├── hosting-deploy.yaml        # Deploys hosting worker
├── hosting-pr-preview.yaml    # PR preview deployments
├── vibes-diy-deploy.yaml      # Deploys main app (tag: vibes-diy@*)
└── ci.yaml                    # PR checks
```

---

## What the CLI Packages Need to Build On

### `create-vibe` (scaffolder — move into monorepo last)
Already published from its own repo. Work here is moving it into the monorepo cleanly and doing a fresh release **after `use-vibes` CLI is solid**.
- **call-ai streaming** from `call-ai/v2/cli.ts` for AI generation mode
- **process.argv** for arg parsing (scaffolder is simple enough to not need cmd-ts)
- Template files (App.jsx skeleton, package.json with `use-vibes` devDep)

### `use-vibes` (runtime CLI)

Architecture: Deno-first with dnt for npm, cmd-ts routing, cement Result pattern, injectable CliOutput — see [cli-architecture.md](cli-architecture.md).

- **Deno-first** — `main.deno.ts` primary entrypoint, `bin.ts` compiled by dnt for npm
- **cmd-ts** — subcommand routing, option parsing, help generation (via `runSafely`)
- **cement Result pattern** — all commands return `Result<void>`, errors propagate as values
- **Injectable CliOutput** — commands accept stdout/stderr functions for testability
- **`.js` import specifiers** — local imports use `.js` for Node/browser compat, Deno uses `--unstable-sloppy-imports`
- **`fs/promises` only** — no `fs.*Sync` anywhere
- **API client** — `vibes-api.ts` wraps `VibeDiyApi` for CLI context with `getCliDashAuth()` and `createCliVibesApi()`
- **Device-code auth** — CSR→cert flow via Clerk, stores device cert + key in keybag
- **vibes.json** parsing + target resolution (`group` → `owner/app/group`)
- **Injectable deps** — commands accept deps interfaces for stub-based testing (not mocks)

### Working commands
- `help` / `--help` / `-h` — generated help from cmd-ts
- `login` — device-code auth via Clerk CSR→cert flow, stores credentials in keybag
- `whoami` — prints handles (from API), device fingerprint, and cert expiry
- `handle register [slug]` — registers a handle for the authenticated user
- `info` — dry-run target resolution from vibes.json (debugging tool)
- `skills` — lists catalog from `@vibes.diy/prompts`
- `system --skills` — assembles full system prompt for selected skills
- Stub commands: `dev`, `live`, `generate`, `edit`, `publish`, `invite`
- 58 Deno tests: unit + smoke across 8 test files

### Planned work
- Live reload — SSE/polling injection (server-side)
- Push — wire `ensureAppSlug` into `live`/`publish` commands
- Invite API client (`createInviteToken` from CLI)
