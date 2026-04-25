# Dev environment state

Local dev state lives in two places. They are NOT equivalent and have very different blast radii.

## Safe to delete

- `vibes.diy/pkg/node_modules/.vite/` — Vite's optimizeDeps + module-graph cache. Recreated on next dev start. Delete this when an importmap or package change isn't picked up by HMR.

## DO NOT delete without explicit user confirmation

- `vibes.diy/pkg/.wrangler/state/` — Cloudflare miniflare's local D1 SQLite + Durable Object state. This holds the user's local dev data: `Apps`, `UserSlugBindings`, `ChatSections`, `ChatContexts`, etc. **Not in git, not in Trash after `rm -rf`, not recoverable.** Wiping it means re-running drizzle migrations to recreate the schema and losing every local app row, chat session, and slug binding the user has built up.

If a "cache clean" is needed and the user hasn't been specific, default to `node_modules/.vite/` only. If you think `.wrangler/state` is implicated, ASK first — frame it as "this would wipe your local apps + chats, are you sure?" so the user can say no.

## Restarting the dev server

Kill the PID listening on `:8888`, then `cd vibes.diy/pkg && NODE_OPTIONS="--max-old-space-size=12288" pnpm dev`. The default node heap (~1.5GB) sometimes OOMs during Vite's optimizeDeps pass — use 12GB to be safe.

## When the SSR import map changes

`vibes.diy/api/svc/intern/grouped-vibe-import-map.ts` and `render-vibe.ts` are SSR'd via React-Router. Vite HMR may not pick up changes here — restart the dev server. Browser also caches the iframe HTML for 24h (`Cache-Control: max-age=86400`); use `navigate_page` with `ignoreCache: true`, or change the iframe URL with a query param to bust.
