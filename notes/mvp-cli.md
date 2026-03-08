# CLI MVP — First Steps

Bootstrap the `use-vibes` CLI from zero to a working `dev` → `publish` loop. Features, interface, and logic only — no code-level references (the codebase is in flux).

---

## Principles

- **Build-free**: `cli.js` bootstraps tsx, which runs `cli.ts` directly — no compile step
- **cmd-ts for routing**: subcommand parsing, option handling, help generation (adopted per Meno's PR review)
- **cement Result pattern**: all commands return `Result<void>`, errors propagate as values
- **Injectable CliOutput**: commands accept stdout/stderr functions for testability and future browser use
- **No sync I/O**: `fs/promises` everywhere, including config and credential loading
- **No localhost**: every environment is a cloud deploy with HTTPS
- **Stdout is the API**: commands that produce data (`skills`, `system`, `whoami`) write to stdout for piping

---

## Step 1: Skeleton — `help` and `whoami` ✅ DONE

**Goal:** CLI runs, dispatches commands, prints help.

**What was built:**
- `cli.js` bootstrap (resolves tsx, spawns `cli.ts`) + `cli.ts` cmd-ts subcommands
- `help` command — loads help text from `help.txt` via cement `loadAsset`
- `whoami` command — returns `Result.Err("Not logged in")`
- `commands/` directory with one file per command + `cli-output.ts` for injectable output
- Stub commands for all unimplemented features (accept positional args via `restPositionals`)
- 22 tests: 14 unit (captureOutput) + 8 smoke (spawn cli.js)

---

## Step 2: Auth — `login` and `whoami`

**Goal:** User can authenticate and their identity persists across commands.

**What to build:**
- `login` command — device-code auth flow via Clerk
- Credential storage — save auth token to a local file (`~/.config/use-vibes/` or similar)
- `whoami` now reads stored credentials and prints the username
- Config loading — async reads, never sync

**Interface:**
```
$ use-vibes login
Open this URL to log in: https://...
Waiting for authentication...
Logged in as jchris

$ use-vibes whoami
jchris
```

**Logic:**
- Device-code flow: request a code from Clerk → print URL → poll for completion → store token
- Credentials stored as JSON, loaded with `fs/promises`
- All subsequent commands that need identity call a shared `getAuth()` that returns the stored user or errors with "run `use-vibes login` first"

---

## Step 3: Config — `vibes.json` loading and target resolution

**Goal:** Commands can resolve targets from vibes.json and the logged-in user.

**What to build:**
- `vibes.json` reader — finds and loads the project config
- Target resolver — turns a bare group name into `{owner}/{app}/{group}`
- Writer — updates vibes.json after pushes (fs entries, new targets)

**Interface:**
- No new CLI command — this is shared infrastructure used by `live`, `publish`, `invite`

**Logic:**
- Walk up from cwd to find `vibes.json` (like how `package.json` is found)
- Target resolution by counting slashes:
  - No arg → `{whoami}/{app}/default`
  - Bare name (`work-lunch`) → `{whoami}/{app}/work-lunch`
  - Fully qualified (`jchris/soup-order/work-lunch`) → used as-is
- After a push: `live` replaces the single `fs` entry for that target, `publish` prepends to the `fs` array
- All reads and writes through `fs/promises`

---

## Step 4: Push — the core `ensureAppSlug` call

**Goal:** CLI can push files to the API and get back a deployed URL.

**What to build:**
- API client — wraps the `ensureAppSlug` endpoint (HTTP or WebSocket, whatever the API expects)
- File collector — reads project files into the request payload
- Response handler — extracts fsId, URL, releaseSeq from response

**Interface:**
- No new CLI command — this is shared infrastructure used by `live` and `publish`

**Logic:**
- Collect files from project directory (App.jsx + related files)
- Send to `ensureAppSlug` with auth token, target info, mode (dev/production)
- On success: return `{ fsId, url, releaseSeq }`
- On duplicate content: API deduplicates, returns existing row
- Same-content pushes are cheap — no new storage

---

## Step 5: `live` and `dev`

**Goal:** `use-vibes dev` watches files and pushes every save to the cloud.

**What to build:**
- `live` command — watch files → debounce → push → print URL
- `dev` command — calls `live` with group = `dev`
- File watcher — native `fs/promises.watch` with recursive option (Node 20+)
- Lint gate — run a quick lint before pushing, keep last-good version live on failure

**Interface:**
```
$ use-vibes dev
Watching for changes...
Pushed to dev → https://coffee-order-dev--jchris.vibecode.garden
  [save App.jsx]
Pushed to dev → https://coffee-order-dev--jchris.vibecode.garden (bafyabc2)
  [save with lint error]
Lint error: unexpected token line 42. Keeping previous version live.
```

**Logic:**
- `watch(dir, { recursive: true })` returns async iterator
- Debounce: wait 100ms after last change event before pushing
- On each push: collect files → lint → if pass, push via API client → update vibes.json `fs` entry → print URL
- On lint failure: print error, keep previous fsId live, don't update vibes.json
- `dev` is a thin wrapper: `await live(["dev"])`
- `dev` is its own command file because it's an extension point (can add dev-specific behavior later)

---

## Step 6: `publish`

**Goal:** One-time push to a target group. No file watching.

**What to build:**
- `publish` command — collect files → push with mode `production` → update vibes.json → print URL → exit

**Interface:**
```
$ use-vibes publish
Published to default → https://coffee-order--jchris.vibecode.garden

$ use-vibes publish work-lunch
Published to work-lunch → https://coffee-order-work-lunch--jchris.vibecode.garden
```

**Logic:**
- Resolve target (no arg = `default` group)
- Collect files, push via API client with `mode: 'production'`
- Prepend new `{ id, ts }` to the target's `fs` array in vibes.json
- Print the URL
- Exit

---

## Step 7: `skills` and `system` ✅ DONE

**Goal:** Agents and humans can read the skill catalog and get assembled system prompts.

**What was built:**
- `skills` command — lists catalog from `@vibes.diy/prompts` via `getLlmCatalog()`
- `system` command — assembles full system prompt via `makeBaseSystemPrompt()` for selected skills
- Both accept `CliOutput` parameter, write to stdout for piping
- `--skills` flag via cmd-ts `option` with empty string default (no sentinel)
- Skill validation against catalog; unknown skills → helpful error
- Composable: `use-vibes system --skills fireproof | pbcopy`

---

## Step 8: `generate` and `edit`

**Goal:** Agents and humans can create and iterate on vibes from the terminal.

**What to build:**
- `generate` command — AI-create a new vibe file (`slug.jsx`) from a prompt
- `edit` command — AI-edit an existing vibe by slug or filename

**Interface:**
```
$ use-vibes generate todo "a collaborative todo list"
Created todo.jsx

$ use-vibes edit todo "add drag-and-drop reordering"
Edited todo.jsx
[streamed diff to stdout]

$ use-vibes edit todo.jsx "add a search bar"
Edited todo.jsx
```

**Logic:**
- `generate`: slug → `slug.jsx` filename. Fail if file already exists. Call call-ai with system prompt (from `use-vibes system` internally) + user prompt. Write result to `slug.jsx`. Register in vibes.json
- `edit`: resolve slug to `slug.jsx` (or use filename directly). Read file, send to call-ai with prompt, write result back, stream diff to stdout
- If `live` is running in another terminal, saved files trigger the normal watch → lint → push cycle
- Enables one directory, many vibes — rapid-fire generation from a single workspace

---

## What comes after

Once steps 1-8 are solid:
- **`invite`** — generate join links (needs API handlers from web MVP)
- **`create-vibe`** — move scaffolder into monorepo, wire to `use-vibes`
- **Live reload** — group URLs auto-refresh on new pushes (SSE or version polling)

---

## Related docs

- [cli-design.md](cli-design.md) — Full architecture: targets, vibes.json, commands
- [cli-architecture.md](cli-architecture.md) — Implementation: cmd-ts, Result pattern, two-file bootstrap, testing
- [cli-mvp-code-review.md](cli-mvp-code-review.md) — Meno's PR feedback (drove cmd-ts adoption)
- [mvp-web.md](mvp-web.md) — Web-only invite path (API handlers needed by CLI invite)
- [mvp-invites.md](mvp-invites.md) — Permissions model and invite flag semantics
