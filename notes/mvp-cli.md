# CLI MVP — Steps

Bootstrap the `use-vibes` CLI from zero to a working `dev` → `publish` loop.

---

## Principles

- **Deno-first**: `main.deno.ts` is the primary runtime entrypoint, with Node compatibility via dnt (`bin.ts`)
- **cmd-ts for routing**: subcommand parsing, option handling, help generation
- **cement Result pattern**: all commands return `Result<void>`, errors propagate as values
- **Injectable CliOutput**: commands accept stdout/stderr functions for testability and future browser use
- **No sync I/O**: `fs/promises` everywhere, including config and credential loading
- **No localhost**: every environment is a cloud deploy with HTTPS
- **Stdout is the API**: commands that produce data (`skills`, `system`, `whoami`) write to stdout for piping

---

## Step 1: Skeleton — `help` and `whoami`

CLI runs, dispatches commands, prints help. Stub commands for unimplemented features.

---

## Step 2: Auth — `login` and `whoami`

**Goal:** User can authenticate and their identity persists across commands.

- `login` — device-code auth flow via Clerk
- Credential storage — save auth token to `~/.config/use-vibes/` or similar
- `whoami` reads stored credentials and prints the username
- Shared `getAuth()` returns stored user or errors with "run `use-vibes login` first"

---

## Step 3: Config — `vibes.json` loading and target resolution

**Goal:** Commands can resolve targets from vibes.json and the logged-in user.

- `vibes.json` reader — walk up from cwd to find it (like `package.json`)
- Target resolver — turns a bare group name into `{owner}/{app}/{group}`
  - No arg → `{whoami}/{app}/default`
  - Bare name (`work-lunch`) → `{whoami}/{app}/work-lunch`
  - Fully qualified (`jchris/soup-order/work-lunch`) → used as-is
- Writer — updates vibes.json after pushes

---

## Step 4: Push — the core `ensureAppSlug` call

**Goal:** CLI can push files to the API and get back a deployed URL.

- API client wraps `ensureAppSlug` endpoint
- File collector reads project files into the request payload
- Response handler extracts fsId, URL, releaseSeq
- Same-content pushes are cheap — API deduplicates

---

## Step 5: `live` and `dev`

**Goal:** `use-vibes dev` watches files and pushes every save to the cloud.

- `live` — watch files → debounce → lint → push → print URL
- `dev` — calls `live` with group = `dev`
- Native `fs/promises.watch` with recursive option (Node 20+)
- Lint gate — keep last-good version live on failure

---

## Step 6: `publish`

**Goal:** One-time push to a target group. No file watching.

- Resolve target (no arg = `default` group)
- Push with `mode: 'production'`
- Update vibes.json, print URL, exit

---

## Step 7: `skills` and `system`

Agents and humans read the skill catalog and get assembled system prompts.

- `skills` — lists catalog from `@vibes.diy/prompts`
- `system --skills fireproof,d3` — assembles full system prompt
- Composable: `use-vibes system --skills fireproof | pbcopy`

---

## Step 8: `generate` and `edit`

**Goal:** AI-create and iterate on vibes from the terminal.

- `generate <slug> "prompt"` — creates `slug.jsx` from a prompt via call-ai
- `edit <slug|file> "prompt"` — AI-edit an existing vibe, streams diff to stdout
- If `live` is running, saved files trigger watch → lint → push automatically

---

## What comes after

- **`invite`** — generate pre-approved instant access tokens (needs API handlers)
- **`create-vibe`** — move scaffolder into monorepo, wire to `use-vibes`
- **Live reload** — group URLs auto-refresh on new pushes (SSE or version polling)

---

## Related docs

- [cli-design.md](cli-design.md) — Full architecture: targets, vibes.json, commands
- [cli-architecture.md](cli-architecture.md) — Implementation: Deno-first, cmd-ts, dnt, testing
- [cli-release-process.md](cli-release-process.md) — How to tag and ship releases
- [mvp-web.md](mvp-web.md) — Web-only invite path
- [mvp-invites.md](mvp-invites.md) — Permissions model and invite flag semantics
