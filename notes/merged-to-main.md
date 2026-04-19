# Merged to main via `jchris/go-live`

Summary of what landed on `main` when the `jchris/go-live` integration merged (via PR #1363). Coarse detail only — for commit-level history see `git log`.

## Features added on `jchris/go-live` (on top of `mabels/vibes-diy-api`)

Work stacked on the Meno base while the integration branch was open. PRs merged into `jchris/go-live` between its creation and its merge to `main`:

- **Image generation stack.** `ImgVibes` component (workspace-wide rename from `ImgGen`), new `img-vibes` npm package, Prodia Flux API (direct PNG, replacing OpenRouter SSE), Fireproof client-side persistence with deterministic prompt→id hashing, regen + version-history navigation, `PRODIA_TOKEN` wired through CI. Follow-up img2img support: `images` (File[]) prop, client-side JPEG resize (≤1024px) for WS-size limits, server-side Prodia multipart, txt2img/img2img cache separation. (#1362 closed, #1365, #1368)
- **WebSocket graceful reconnection.** Stale-connection eviction via slot-based ownership guard; `send()` rejects CLOSING/CLOSED with `Result.Err`; `close()` evicts cache proactively; failed sends close the socket. Shipped with test coverage. (#1329 closed → #1333)
- **Chat / LLM context.** Reconstruct assistant messages from stored block messages for full multi-turn LLM context; strengthen db-name stability in system prompt; restore `applicationChats` table lookup for app-mode chat loads that regressed under the mode refactor. (#1335, #1340)
- **Editor code save persistence.** Non-chat modes (`fs-set` / `fs-update`) now trigger `ensureAppSlugItem`; WS emits code blocks during FS prompts; `CodeEndMsg.stats` field added via `satisfies` (fixes `complete=false`); client resolves correct `fsId` via `block.end.streamId`; "User edited code" label for promptless blocks. (#1366)
- **Sidebar redesign.** Shared `PillPortal`, recent-vibes list, New Vibe + About links, neobrutalista border, `VibesSwitch` pill color / symmetric stretched path, cream (`#FFFEF0`) pill consistency. (#1327, #1337, #1361)
- **Auth / sharing.** Wait for Clerk to load before `getToken`; return immediately when not signed in; redirect back to shared vibe after sign-in; Share button + modal in editor header with open-access toggle labels. (#1292, follow-ups)
- **CLI + deploy plumbing.** CLI stable-entry routing + direct `core-cli` handler; `loadAsset`-driven CLI help footer + system-prompt footer; OpenRouter verbosity for initial prompts; deploy script `--env` restoration; `pkg@` tag docs; automatic PR preview deployments.
- **Reports / analytics.** DB report migrated from subprocess CLI to Drizzle ORM (raw SQL eliminated); Vibes-With-Data trend chart; `growth-report` script.
- **Test infrastructure.** Auto-isolate test DBs in `createVibeDiyTestCtx`; clean stale SQLite files in global test setup; API test-timeout + block-end sequencing fixes.
- **Dep alignment.** `@fireproof/core-*` 0.24.13 → 0.24.19, `pnpm dedupe` pass.

## Meno architecture (new to `main` via `mabels/vibes-diy-api`)

The integration base itself was the larger, load-bearing change. These are architectural shifts that existed on `mabels/vibes-diy-api` before `jchris/go-live` was cut and that came with it to `main`:

- **Split API packages.** New `@vibes.diy/api-impl`, `@vibes.diy/api-svc`, `@vibes.diy/api-types`, `@vibes.diy/api-sql` — replacing the monolithic chat handler with typed services, providers, and protocol types.
- **Prompt-chat-section protocol.** WebSocket-driven chat protocol with explicit modes: `chat`, `img`, `fs-set`, `fs-update`, creation. `PromptStyle` system and a rules-bag abstraction that replaces scattered conditionals across prompt assembly.
- **Drizzle SQL layer.** Schema definitions and migrations under Drizzle; `drizzle-kit push` in test setup; `drizzle.libsql.config.ts`. Removes raw-SQL surface.
- **Runtime / base split.** `@vibes.diy/base`, `vibes.diy/vibe/runtime`, `vibes.diy/vibe/types` as separate workspaces with explicit dependency registration (`register-dependencies.ts`). Replaces the single `use-vibes/base` blob for the app's own component set.
- **Sandbox server restructure.** `srv-sandbox` with grouped vibe import maps and dep gates (e.g. `registerImgVibes`) — decouples runtime deps like `call-ai` / `img-vibes` from the core bundle.
- **Test infrastructure.** `globalSetup.libsql.ts` provides `VIBES_DIY_TEST_SQL_URL` via Vitest `project.provide`, PostgreSQL vs SQLite flavour switching via `DB_FLAVOUR` inject, isolated per-test DB support.
- **Queue worker surface.** `vibes.diy/api/queue/` handlers (e.g. `evt-app-setting` stub) and deploy-action wiring for `LLM_BACKEND_URL` / `LLM_BACKEND_API_KEY` on the queue consumer.
- **Deploy tag families.** Formalized `vibes-diy@p*` (prod) and `vibes-diy@c*` (canary) for website/backend deploys, `pkg@{p,s,other}*` for package publishes, separate `use-vibes@*` / `call-ai@*` for npm. Prod-only queue deploys on `p*` tags.
- **Dashboard / session-token rewrite.** Clerk-based token flow with `CLOUD_SESSION_TOKEN_PUBLIC` and device-ID CA scaffolding; replaces the previous auth middleware flagged by legal/compliance.
