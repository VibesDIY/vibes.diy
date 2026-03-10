# CLI MVP — Steps

Bootstrap the `use-vibes` CLI from zero to a working `dev` → `publish` loop.

## Dependency chain

```
login → config → push → live → dev
                     ↘ publish
```

- **login** — device-code auth, stores credentials
- **config** — vibes.json loading + target resolution (`{whoami}/{app}/{group}`)
- **push** — wraps `ensureAppSlug` API, needs auth token + resolved target
- **live** — watch files → debounce → push on save
- **dev** — sugar for `live` with group = `dev`
- **publish** — one-time push, no watching

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

## ~~Step 1: Skeleton — `help` and `whoami`~~ ✅

CLI runs, dispatches commands, prints help. Stub commands for unimplemented features.
Shipped in `use-vibes@0.19.27-dev-cli`.

---

## Step 2: Auth — `login` and `whoami`

**Goal:** User can authenticate and their identity persists across commands.

- `login` — device-code auth flow via Clerk
- Credential storage — save auth token to `~/.config/use-vibes/` or similar
- `whoami` reads stored credentials and prints the Clerk user ID + all linked handles
- Shared `getAuth()` returns stored user (Clerk ID + handles) or errors with "run `use-vibes login` first"

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

## ~~Step 7: `skills` and `system`~~ ✅

Agents and humans read the skill catalog and get assembled system prompts.

- `skills` — lists 6 skills from `@vibes.diy/prompts` (callai, fireproof, image-gen, web-audio, d3, three-js)
- `system --skills fireproof,d3` — assembles full system prompt (~4.7KB with docs)
- Composable: `use-vibes system --skills fireproof | pbcopy`
- Defaults to `fireproof,callai` when no `--skills` flag given
- **TODO**: System prompt should tell agents not to `npm install` additional packages — all imports resolve via esm.sh at runtime
- **TODO**: Remove "coming soon" from `use-vibes/pkg/README.md` when `dev` and `publish` commands ship
Shipped in `use-vibes@0.19.27-dev-cli`.

---

## Step 8: `edit` and `generate` signpost

**Goal:** AI-edit existing vibes from the terminal. New vibe creation stays in `create-vibe`.

- `edit "prompt"` — AI-edit app.jsx in place, streams diff to stdout
- `generate` — prints a signpost: `cd .. && npm create vibe my-app "describe what you want"`
- If `live` is running, saved files trigger watch → lint → push automatically

AI generation of new vibes belongs in `create-vibe` at scaffold time, not in `use-vibes`. One directory = one vibe. See [create-vibe-plan.md](create-vibe-plan.md).

---

## What comes after

- **Access** — the deploy URL is the join link (e.g. `vibes.diy/vibe/jchris/cleaning-crew/friends-club`). Groups are private by default; owners opt in to public reads. Visitors request write access, moderators approve in real time. Pre-approved instant tokens (`use-vibes invite`) are a future convenience, not the primary flow. See [mvp-invites.md](mvp-invites.md)
- **`create-vibe`** — dry scaffold shipped (`create-vibe@1.4.0-dev`), optional AI generation via prompt arg is future (see [create-vibe-plan.md](create-vibe-plan.md))
- **Live reload** — group URLs auto-refresh on new pushes (SSE or version polling)

---

## Related docs

- [cli-design.md](cli-design.md) — Full architecture: targets, vibes.json, commands
- [cli-architecture.md](cli-architecture.md) — Implementation: Deno-first, cmd-ts, dnt, testing
- [cli-release-process.md](cli-release-process.md) — How to tag and ship releases
- [mvp-web.md](mvp-web.md) — Web-only invite path
- [mvp-invites.md](mvp-invites.md) — Permissions model and invite flag semantics
