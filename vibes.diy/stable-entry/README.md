# stable-entry

Reverse proxy Cloudflare Worker sitting in front of vibes.diy. Supports cookie-based multi-backend dispatch.

## Architecture

```
/.stable-entry/            → static HTML (from [assets])
/.stable-entry/app.js      → static React app (from [assets])
/.stable-entry/config.json → worker: returns available backend keys
everything else            → worker: proxy to selected backend
```

## Env vars

- `BACKEND` — default backend URL (var in wrangler.toml)
- `BACKENDS` — optional JSON mapping keys to URLs, e.g. `{"dev":"https://dev-v2.vibesdiy.net"}`

## Backend selection

### Via query param

Visit any URL with `?_backend=<key>` to set the cookie and redirect:

```
https://vibes.diy/?_backend=dev    # sets cookie, redirects to /
https://vibes.diy/?_backend=       # clears cookie, back to default
```

The `_backend` param is stripped and you're redirected to the same path — e.g. `/some/page?_backend=dev` redirects to `/some/page`.

### Via UI

Visit `/.stable-entry/` for a browser UI to pick a backend.

### Resolution order

1. `Vibes-Backend` cookie → look up key in `BACKENDS`
2. `BACKEND` env var (default)

## Local dev

```
pnpm install
npx wrangler dev
```

Create `.dev.vars` to test with BACKENDS:
```
BACKENDS={"dev":"https://dev-v2.vibesdiy.net"}
```

## Verification

```
curl -s http://localhost:8787/.stable-entry/config.json
# → {"keys":["dev"]}

curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/.stable-entry/
# → 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/.stable-entry/app.js
# → 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/
# → 200 (proxied to BACKEND)
```

## Deploy

Deployed via GitHub Actions on push to `main` when `vibes.diy/stable-entry/**` changes, or via manual `workflow_dispatch`. See `.github/workflows/stable-entry-deploy.yaml`.

GH repo-level variables:
- `STABLE_ENTRY_BACKEND` — overrides wrangler.toml BACKEND at deploy time
- `STABLE_ENTRY_BACKENDS` — synced to worker as BACKENDS
