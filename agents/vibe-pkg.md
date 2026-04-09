# Self-Hosted Package Serving (/vibe-pkg/)

The `@vibes.diy/*` packages (vibe-runtime, vibe-types, base, etc.) are served by the vibes.diy worker itself at `/vibe-pkg/<npm-path>`, not fetched from esm.sh. This keeps versions consistent with the deployed code.

## Why

esm.sh caches aggressively and the `privateNpm:` flag in `grouped-vibe-import-map.ts` doesn't pin versions. Serving from `/vibe-pkg/` means the packages always match what was built at deploy time.

## Configuration

- Set `WORKSPACE_NPM_URL` in the GitHub environment to `https://<domain>/vibe-pkg/`
- In dev: defaults automatically to `https://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}/vibe-pkg/` (Vite serves them)
- In prod: must be explicitly set (e.g. `https://prod-v2.vibesdiy.net/vibe-pkg/`)
- Without it, prod falls back to `PUBLIC_NPM_URL` → `https://esm.sh` which caches old versions

## Key files

- Config: `vibes.diy/api/svc/create-handler.ts`
- Import map: `vibes.diy/api/svc/intern/grouped-vibe-import-map.ts` — `privateNpm:` entries use this URL
