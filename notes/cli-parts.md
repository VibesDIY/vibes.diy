# Existing CLI Parts Inventory

What's already in the repo that the `create-vibe` and `use-vibes` CLI packages can reuse.

---

## CLI Framework: `cmd-ts`

Already used in two places — lightweight, type-safe, zero-config CLI builder.

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
cmd-ts           — CLI framework (already in use)
zx               — Shell scripting in JS
esbuild          — Fast bundling
@babel/parser    — AST analysis
random-words     — Slug generation
drizzle-orm      — Database schema
dotenv           — .env loading
find-up          — Config file discovery
```

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

### `create-vibe` (scaffolder)
- **call-ai streaming** from `call-ai/v2/cli.ts` for AI generation mode
- **cmd-ts** for arg parsing
- Template files (App.jsx skeleton, package.json with `use-vibes` devDep)

### `use-vibes` (runtime CLI)
- **ensureAppSlug API** for pushing code to cloud targets
- **File watching** (chokidar or fs.watch — not yet in repo, needs adding)
- **ESLint** integration for pre-push linting
- **Device-code auth** flow (not yet built)
- **cmd-ts** for subcommands (`live`, `publish`, `invite`; `dev` is sugar for `live dev`)
- **dotenv** for config
- **vibes.json** parsing for app identity and target resolution

### Not yet built (new work)
- File watcher for `use-vibes live`
- Target resolution (`group` → `owner/app/group` via vibes.json)
- Cloud push protocol (API client for ensureAppSlug from CLI context)
- Device-code login flow
- SSE/polling live reload injection (server-side)
- Invite API client (`createInviteToken` from CLI)
- Cross-user target permissions
