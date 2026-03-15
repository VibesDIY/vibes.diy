# Existing CLI Parts Inventory

What's already in the repo that the `create-vibe` and `use-vibes` CLI packages can reuse.

**Branch locations**: CLI code on `jchris/cli-design`, create-vibe on `jchris/create-vibe`, these notes on `jchris/cli-notes`.

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
| `pnpm check` | build + lint + test + cli tests + hosting tests |
| `pnpm test:all` | Runs tests across all workspace packages |

---

## `use-vibes` CLI (current state)

Architecture: needs refactor to request/response/output-serializer pattern — see [cli-architecture.md](cli-architecture.md) and [cli-hello-world.md](cli-hello-world.md).

### Working commands
- `--help` / no args — help text from dispatcher
- `info [target]` — shows vibes.json config, resolves fully-qualified targets
- `skills` — lists skill catalog from `@vibes.diy/prompts`
- `system --skills` — assembles full system prompt for selected skills
- `whoami` — stub (returns "not yet implemented")

### Not yet implemented
- `login` — device-code auth (removed from PR #1086 per review; will use `VibesDiyApiIface`)
- `dev` / `live` / `publish` — file push commands
- `generate` / `edit` — AI generation commands
- 36 vitest tests across 4 test files

### Planned work
- Auth via `VibesDiyApiIface` (Meno provides working impl)
- Push — wire `ensureAppSlug` into `live`/`publish` commands
- Live reload — SSE/polling for group URLs
