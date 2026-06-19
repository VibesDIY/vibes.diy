# Self-Hosted Package Serving (/vibe-pkg/)

The `@vibes.diy/*` packages (vibe-runtime, vibe-types, base, etc.) are **built
from the monorepo workspace source at deploy time** and served by the vibes.diy
worker itself at `/vibe-pkg/<npm-path>` — not fetched from esm.sh or any npm
registry. `vite-plugin-workspace-packages.ts` compiles each workspace package
from source into the worker's static assets (`_vibe-pkg/<pkg>/index.js`); at
runtime the worker serves `/vibe-pkg/*` from `env.ASSETS` (`pkg/workers/app.ts`).
This keeps the browser packages consistent with the deployed code.

**npm-independent.** Because `/vibe-pkg/` is built from source, a `pkg@p*` npm
publish has **no effect** on what browsers load — that's controlled solely by the
`vibes-diy@c*`/`@p*` deploy commit. The npm packages are a separate channel for
external consumers (the `vibes-diy` CLI, `use-vibes`, `@vibes.diy/*` imported in
users' own Node/server code). See [deploy-tags.md § vibe-pkg vs `pkg@*` publishes](deploy-tags.md#vibe-pkg-vs-pkg-publishes--two-independent-distribution-channels).

## Why

esm.sh caches aggressively and the `privateNpm:` flag in `grouped-vibe-import-map.ts` doesn't pin versions. Building from source and serving from `/vibe-pkg/` means the packages always match what was built at deploy time. (Only when `WORKSPACE_NPM_URL` is unset does prod fall back to esm.sh — see Configuration below.)

## Configuration

- Set `WORKSPACE_NPM_URL` in the GitHub environment to `https://<domain>/vibe-pkg/`
- In dev: defaults automatically to `https://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}/vibe-pkg/` (Vite serves them)
- In prod: must be explicitly set (e.g. `https://prod-v2.vibesdiy.net/vibe-pkg/`)
- Without it, prod falls back to `PUBLIC_NPM_URL` → `https://esm.sh` which caches old versions

## Caching

`WORKSPACE_NPM_URL` carries a per-deploy `?v=<commit-sha>` stamp (appended in `vibes.diy/actions/deploy/action.yaml` and the PR-preview workflow), so the `/vibe-pkg/` import-map URLs are versioned per deploy. The worker serves stamped requests immutably (`max-age=31536000, immutable`) and unstamped ones with a 60s fallback — see `vibes.diy/pkg/workers/vibe-pkg-cache.ts`. A new deploy mints a fresh `?v=`, so it's a guaranteed cache miss and cuts over instantly.

## Key files

- Config: `vibes.diy/api/svc/create-handler.ts`
- Import map: `vibes.diy/api/svc/intern/grouped-vibe-import-map.ts` — `privateNpm:` entries use this URL
- Cache policy: `vibes.diy/pkg/workers/vibe-pkg-cache.ts` — immutable-vs-fallback decision for the route
