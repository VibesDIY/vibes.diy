# Code MVP Task List

Board demo acceptance criteria + CLI vision. Each task has: user benefit, tech how, and dependency chain.

---

## FRONTEND

### F0. Reconcile sidebar features
The sidebar has diverged — vibe card, publish overlay, settings, invites, and DB explorer all need a coherent home.
- **Tech**: Audit `SessionSidebar.tsx`, `ShareModal.tsx`, `VibesSwitch`, and settings/groups routes. Decide what lives in sidebar vs overlay vs route. Reintegrate vibe card with the published vibes overlay so publish state is visible from the sidebar
- **Dependencies**: None. Unlocks: F1 publish, F3 DB explorer, F4 invites, F6 user list — all need a place to live in the sidebar

### F1. Wire publish button
Users can publish their vibe to a public URL with one click.
- **Tech**: Connect `onPublish` prop in `ResultPreviewHeaderContent.tsx` (lines 131-141) to call `ensureAppSlug` WebSocket API with extracted code
- **Dependencies**: F0 (sidebar reconciliation decides where publish lives). Unlocks: C1 publishing e2e, F5 mobile published vibes

### F2. Code editor lets you edit
Users can hand-edit generated code and see changes live before publishing.
- **Tech**: Export `getCode()` from `CodeEditor.tsx` (lines 25-56), ensure edits flow back to preview iframe and are captured by publish handler
- **Dependencies**: None. Unlocks: F1 publish (needs to grab edited code, not just generated)

### F3. Integrate DB Explorer
Users can browse and edit their app's Fireproof data in a visual explorer.
- **Tech**: Integrate Selem's DB explorer (PR #1085) into the app view — likely as a panel/tab alongside code editor
- **Dependencies**: PR #1085 polish. Unlocks: debugging, data visibility for multi-device sync

### F4. Re-enable invite route + instant join link
Users can generate an invite URL and share it manually to grant access.
- **Tech**: Rename `invite.tsx-off` → `invite.tsx`, fix imports, register in router. Wire to `createInviteToken` API for link-style invites
- **Dependencies**: A1 (create invite handler). Unlocks: C2 invite e2e

### F5. Mobile responsive published vibes
Published vibes work on phones — the whole point of "cross-browser/mobile."
- **Tech**: Add viewport detection in `vibe.$userSlug.$appSlug.tsx`, responsive iframe classes, hide sidebar on mobile by default
- **Dependencies**: F1 (needs publishing to work first to test). Unlocks: criteria #5

### F6. List users in a vibe
Vibe owner can see who has access and who accepted invites.
- **Tech**: UI in settings/admin panel calling `listAcceptedInvites` API. Show usernames, roles, accept status
- **Dependencies**: A4 (list invites handler). Unlocks: invite management, revocation

### F7. Map groupIds to sandbox appSlug
Each group/install gets its own sandboxed data partition via appSlug mapping.
- **Tech**: Connect `installId`/`groupId` in URL structure to `appSlug` in backend. Ensure `constructVibesDatabaseName()` uses correct partitioning. **Note**: `reqEnsureAppSlug` in `msg-types.ts` currently has no `groupId` field — the CLI target model (`owner/app/group`) requires adding group support to the API request types
- **Dependencies**: URL structure (done). Unlocks: proper multi-tenant data isolation, CLI target resolution

### F8. Sync status indicator
Users know when their data is syncing vs offline.
- **Tech**: New component reading `attachState` from `useFireproof` hook, displayed in sidebar/header
- **Dependencies**: P1 (FPCLOUD_URL must be configured). Unlocks: user confidence in sync

---

## API SERVER

### A1. Expose `createInviteToken` handler
Backend can create invite codes for sharing vibes.
- **Tech**: New `svc/public/create-invite-token.ts` EventoHandler wrapping `invite-system.ts:40-122`. Register in `vibes-msg-evento.ts`
- **Dependencies**: None (logic exists). Unlocks: F4 invite UI, C2 invite e2e

### A2. Expose `acceptInvite` handler
Invited users can accept and gain access to shared vibes.
- **Tech**: New `svc/public/accept-invite.ts` EventoHandler wrapping `invite-system.ts:146-234`. Register in `vibes-msg-evento.ts`
- **Dependencies**: A1 (need invite to accept). Unlocks: C2 invite e2e

### A3. Expose `getFPToken` handler
Shared users get Fireproof cloud tokens for synced access.
- **Tech**: New `svc/public/get-fp-token.ts` EventoHandler wrapping `invite-system.ts:311-392`. Returns ledger/tenant/roles for owner or shared path
- **Dependencies**: A2 (need accepted invite for shared path). Unlocks: multi-device sync for invited users

### A4. Expose `listAcceptedInvites` handler
Vibe owners can see who accepted their invites.
- **Tech**: New `svc/public/list-accepted-invites.ts` EventoHandler wrapping `invite-system.ts:236-295`
- **Dependencies**: A1, A2. Unlocks: F6 user list UI

### A5. Expose `deleteInviteToken` + `deleteAccept` handlers
Owners can revoke access.
- **Tech**: Two new EventoHandlers wrapping `invite-system.ts:124-144` and `297-309`
- **Dependencies**: A1, A2. Unlocks: access management

### A6. Slug availability check (optional)
Users see if their desired publish URL is taken before publishing.
- **Tech**: New endpoint querying `sqlUserSlugBinding` / `sqlAppSlugBinding` without creating
- **Dependencies**: None. Unlocks: better publish UX (nice-to-have)

---

## CORE FEATURES (e2e flows)

### C1. Publishing e2e
User goes from prompt → generated code → published URL → working app.
- **Tech**: F1 + F2 + existing backend (`ensureAppSlug`) + existing serve pipeline (`serv-entry-point.ts` + `render-vibe.ts`)
- **Dependencies**: F1, F2. Unlocks: criteria #4, #5

### C2. Invite e2e
Owner creates invite link → shares URL → invitee accepts → sees app + data.
- **Tech**: F4 frontend + A1-A3 API handlers + `getFPToken` for Fireproof cloud access
- **Dependencies**: A1-A3, F4. Unlocks: criteria #7

### C3. Multi-device sync e2e
User logs in on second device → sees same data → writes sync both ways.
- **Tech**: Auto-attach on Clerk login (exists in `use-vibes/base/index.ts`), `UseVibesStrategie` token flow, FPCLOUD_URL endpoint
- **Dependencies**: P1 (cloud infra). Unlocks: criteria #6

---

## PRODUCTION ENV

### P1. Configure FPCLOUD_URL
Sync actually works — data flows to cloud and back.
- **Tech**: Set `FPCLOUD_URL` + `DASHBOARD_URL` in GitHub env vars, verify `ensureCloudToken()` returns valid tokens
- **Dependencies**: Fireproof cloud instance running (cement v0.5.33, connect deployment). Unlocks: C3 sync, criteria #6

### P2. Run D1 migrations for invite tables
Invite system has its database tables in production.
- **Tech**: Run `pnpm run drizzle:d1-remote` — creates `InviteTokens` + `AcceptInvites` tables
- **Dependencies**: None. Unlocks: A1-A5 invite handlers

### P3. Deploy API with invite handlers
Invite system is live.
- **Tech**: Tag `vibes-diy@s*` for staging, `vibes-diy@p*` for production after `pnpm check` passes
- **Dependencies**: A1-A5, P2. Unlocks: C2 invite e2e in production

### P4. Verify domain routing
Published vibes resolve correctly on all configured domains.
- **Tech**: Test `*.vibecode.garden` subdomain pattern `{appSlug}--{userSlug}.vibecode.garden`
- **Dependencies**: Cloudflare zone config. Unlocks: criteria #5

---

## METERING / QUOTA

### M1. Merge rate limiter
Users get fair usage limits — prevents runaway costs.
- **Tech**: Merge `selem/rate-limiter` branch — has tier system (FREE $5/day, PRO $10/day), KV-based budget tracking, Durable Object per-user DBs
- **Dependencies**: Review/testing. Unlocks: M2 usage display

### M2. Usage display UI
Users see how much they've used before hitting limits.
- **Tech**: Frontend component reading from rate-limiter service, show daily/monthly consumption vs tier limits
- **Dependencies**: M1. Unlocks: user self-service, reduces support load

### M3. Storage quotas
Prevent unbounded growth of published vibes and assets.
- **Tech**: Count published apps per user in `sqlApps`, enforce limits at `ensureAppSlug` time
- **Dependencies**: M1 (use same tier system). Unlocks: sustainable hosting

---

## CLI (two packages: `create-vibe` + `use-vibes`)

See [cli-design.md](cli-design.md) for full architecture.

### L0. Bootstrap `use-vibes` CLI ✅ DONE
Add CLI to the existing `use-vibes` workspace package.
- **Tech**: Two-file bootstrap (`cli.js` → tsx → `cli.ts`), cmd-ts for subcommand routing, cement Result pattern, injectable CliOutput — see [cli-architecture.md](cli-architecture.md). `commands/` directory with one file per command, stub commands for all unimplemented features.
- **Dependencies**: None. Unlocks: L2a auth, L3b skills/system

### L0b. Ship call-ai v2 as new major release (#1088)
`prompts` currently inlines a `ChatMessage` type as a workaround for the unpublished `@vibes.diy/call-ai-v2` workspace dep. Ship v2 as the next major of the existing `call-ai` package.
- **Tech**: Move/adapt v2 implementation into `call-ai/pkg`, bump to next major, publish. Update `prompts` to depend on published `call-ai`. Update release workflow to publish `call-ai` before `prompts`. Add npm smoke gate in CI (`npx use-vibes --help` in clean env)
- **Dependencies**: L0 (CLI working). Unlocks: clean npm installs, removes inlined ChatMessage type from prompts

### L1. Move `create-vibe` into monorepo
Already published from its own repo. Move it in and do a fresh release **after `use-vibes` CLI is solid**.
- **Tech**: Move `create-vibe` scaffolder into monorepo workspace. Update to generate `vibes.json` (app identity + targets) and `package.json` (scripts wired to `use-vibes`). AI generation via call-ai stays as-is
- **Dependencies**: L2b, L3 (use-vibes CLI must be working first). Unlocks: `npm create vibe` with proper use-vibes integration

### L2a. CLI auth (`use-vibes login` / `use-vibes whoami`)
Authenticate and identify the current user. Owner defaults to `whoami` result for all target resolution.
- **Tech**: `use-vibes login` — device-code auth flow, stores credentials locally. `use-vibes whoami` — prints the logged-in username. Required before `live` or `publish`
- **Dependencies**: L0. Unlocks: L2b (all commands need an owner)

### L2b. CLI live (`use-vibes live <group>`)
Watch files, push every save to a target group. `use-vibes dev` is sugar for `use-vibes live dev`. No localhost.
- **Tech**: Native `fs/promises.watch` (Node 20+ recursive) → debounce → lint → push to target via API → print group URL. No chokidar. Requires login. Keep last-good-version live on lint failure. Target resolved from vibes.json: bare group → `{whoami}/{app}/{group}`, fully-qualified used as-is. URL: `{appSlug}--{userSlug}.vibecode.garden` (appSlug absorbs app+group)
- **Dependencies**: L0, L2a, ensureAppSlug API (working). Unlocks: L3 publish, the "deploy as save" experience

### L3. CLI publish (`use-vibes publish [group]`)
One-time push of current code to a target group. No arg = `default` group (shortest URL, no group segment).
- **Tech**: Resolve target from vibes.json, call `ensureAppSlug` with `mode: 'production'`, pin release tag. `releaseSeq` in DB handles versioning. Can override app: `use-vibes publish jchris/soup-order/work-lunch`
- **Dependencies**: L2b. Unlocks: production deployments from CLI

### L3b. CLI skills + system prompt (`use-vibes skills` / `use-vibes system`) ✅ DONE
Two commands: `skills` lists the catalog with descriptions (for LLM decision-making), `system` emits the full assembled prompt for selected skills.
- **Tech**: `use-vibes skills` prints name + description from `getLlmCatalog()` in `@vibes.diy/prompts`. `use-vibes system --skills fireproof,d3` loads `.txt` docs, assembles via `makeBaseSystemPrompt()`, prints to stdout. Both accept `CliOutput` parameter. Skill validation against catalog; unknown skills → helpful error. Composable: `use-vibes system --skills fireproof | pbcopy`
- **Dependencies**: L0, `@vibes.diy/prompts` package. Unlocks: L3c generate/edit (needs system prompt), BYO-token workflows

### L3c. CLI generate (`use-vibes generate <slug> "prompt"`)
AI-create a new vibe from the terminal. Creates `slug.jsx` from a natural language prompt. The slug controls the filename and becomes the vibe's identity in vibes.json.
- **Tech**: Uses call-ai streaming + system prompt from `use-vibes system` internally. Slug must not already exist as a file. Registers the new vibe in vibes.json. If `live` is running, the new file triggers watch → lint → push automatically. Enables one directory, many vibes — rapid-fire generation from a single workspace
- **Dependencies**: L3b (system prompt), call-ai. Unlocks: L3d edit, agent-driven development from CLI

### L3d. CLI edit (`use-vibes edit <slug|file> "prompt"`)
AI-edit an existing vibe from the terminal. Reads the file by slug (resolves to `slug.jsx`) or filename, sends to call-ai with prompt, writes result back, streams diff to stdout.
- **Tech**: Uses call-ai streaming + system prompt from `use-vibes system` internally. If `live` is running, saved file triggers watch → lint → push automatically. Composable: `generate` + `edit` + `live` = full AI dev loop from terminal
- **Dependencies**: L3b (system prompt), call-ai. Unlocks: iterative AI development from CLI

### L4. CLI invite (`use-vibes invite <group> [flags]`)
Generate a join link for a target group from the terminal.
- **Tech**: Call `createInviteToken` API with `style: 'link'`, print URL to stdout. Default permissions come from the target's `invite` field in vibes.json, falling back to collaborative default (`access: "write"`, `inviteWriter: true`). Flags: `--reader`, `--no-invite`, `--invite-reader`, `--invite-writer` (see [mvp-invites.md](mvp-invites.md)). Full target path enables cross-user permissions (e.g., joe can deploy to `jchris/foo-bar/amaze` if granted)
- **Dependencies**: A1 (invite handler). Unlocks: sharing from CLI without opening browser

### L5. Live reload for group URLs
Group URLs auto-refresh when new code is pushed — feels like local dev but in the cloud.
- **Tech**: SSE endpoint or polling "version pointer" on served URL. Runtime checks for new `fsId`, triggers reload. All HTTPS, no localhost
- **Dependencies**: L2b. Unlocks: instant feedback loop
