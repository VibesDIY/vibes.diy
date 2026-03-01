# Running Locally

## Prerequisites

- Node >= 22
- pnpm 10.20.0 (`corepack enable && corepack prepare`)
- mkcert certs already exist at `vibes.diy/pkg/_wildcard.localhost.vibesdiy.net+1*.pem`

## Environment

Copy and fill in the two API keys:

```bash
cp vibes.diy/.env.example vibes.diy/.env
```

Required vars:
- `VITE_CALLAI_API_KEY` — OpenRouter API key (client-side)
- `SERVER_OPENROUTER_API_KEY` — OpenRouter API key (server-side)

Optional:
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth
- `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` — analytics

## Install & Run

```bash
pnpm install
pnpm dev
```

Dev server runs at `https://vite.localhost.vibesdiy.net:8888` — wildcard DNS resolves `*.localhost.vibesdiy.net` to `127.0.0.1`, no `/etc/hosts` needed.

The dev server uses Cloudflare Vite plugin for Workers emulation and auto-initializes a local D1 database via drizzle on startup.

## Build

```bash
pnpm build        # runs core-cli tsc across all workspace packages
```

## Quality Checks

```bash
pnpm check        # format + build + test + lint (run before commit)
pnpm format       # prettier
pnpm lint         # eslint
```

## Tests

```bash
cd vibes.diy/tests && pnpm test              # vibes.diy app tests
cd vibes.diy/tests && pnpm test --reporter=dot  # quiet mode
```

## Gotchas

- `pnpm dev` delegates to `vibes.diy/pkg` which runs `react-router dev`
- HTTPS certs are required — generated via mkcert, already on this machine
- Workspace packages may need `pnpm build` first if you see import errors from `@vibes.diy/*` packages
- VSCode may show red squiggles due to TS SDK mismatch — use Cmd+Shift+P → "TypeScript: Restart TS Server" or set `typescript.tsdk` in `.vscode/settings.json`
