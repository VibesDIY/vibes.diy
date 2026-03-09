# CLI Design: Two-Package Architecture

## Packages

### `create-vibe` — One-shot scaffolder

Already published on npm as `create-vibe`, runs via `npm create vibe`. Currently lives in its own repo — work here is moving it into the monorepo and doing a fresh release. **Comes after `use-vibes` CLI is solid.**

```bash
npm create vibe                          # interactive scaffold
npm create vibe my-app                   # scaffold into ./my-app
npm create vibe "kanban board with tags" # AI-generated App.jsx
```

Generates:
```
my-app/
├── App.jsx
├── package.json
└── vibes.json        # app identity + targets
```

Generated `vibes.json`:
```json
{
  "app": "coffee-order",
  "targets": {
    "dev": {}
  }
}
```

Generated `package.json`:
```json
{
  "scripts": {
    "start": "use-vibes dev",
    "deploy": "use-vibes publish"
  },
  "devDependencies": {
    "use-vibes": "^0.15.0"
  }
}
```

The AI generation path uses call-ai to turn a natural language description into a working App.jsx right in the terminal. This is the differentiator vs `npm create vite` — they scaffold static templates, we generate working apps.

### `use-vibes` — Library + Runtime CLI

Already published on npm as `use-vibes`. Currently a React hooks library — adds a `bin` entry for the CLI. Same package, two roles:

- **Library**: `import { useFireproof } from "use-vibes"` (existing)
- **CLI**: `npx use-vibes dev` / `use-vibes live family-reunion` (new)

This is the same pattern as `vite` — importable library AND executable CLI in one package.

```bash
use-vibes login                   # device-code auth, stores credentials
use-vibes whoami                  # print current user (e.g., "jchris")
use-vibes dev                     # live-push to dev group (sugar for: use-vibes live dev)
use-vibes live work-lunch         # live-push to work-lunch group
use-vibes publish family-reunion  # one-time push to family-reunion group
use-vibes invite work-lunch            # (future) pre-approved instant access token (5 min TTL, writer)
use-vibes invite work-lunch --reader   # (future) pre-approved token for read-only access
use-vibes invite work-lunch --ttl 15   # (future) custom TTL in minutes
use-vibes generate my-app "build a sales dashboard"  # AI-generate my-app.jsx (new vibe)
use-vibes edit my-app "make the header dark"         # AI-edit my-app.jsx
use-vibes edit my-app.jsx "add a search bar"         # AI-edit by filename
```

---

## Domain Model: Targets

A **target** is a fully-qualified deployment destination: `{owner}/{app}/{group}`.

```
jchris/coffee-order/work-lunch
└owner─┘ └───app────┘ └─group──┘
```

- **owner** — defaults to `use-vibes whoami` result (the logged-in user)
- **app** — from `vibes.json` `"app"` field
- **group** — a named audience/install (e.g., `dev`, `work-lunch`, `family-reunion`)

### vibes.json

The project's `vibes.json` stores the app name and known targets:

```json
{
  "app": "coffee-order",
  "targets": {
    "dev": {
      "fs": [{ "id": "bafyabc1", "ts": "2026-03-06T17:00:00Z" }]
    },
    "work-lunch": {
      "fs": [
        { "id": "bafydef3", "ts": "2026-03-06T16:00:00Z" },
        { "id": "bafyabc2", "ts": "2026-03-05T12:00:00Z" }
      ]
    },
    "family-reunion": {
      "fs": [
        { "id": "bafyabc1", "ts": "2026-03-04T10:00:00Z" }
      ]
    },
    "jchris/soup-order/work-lunch": {
      "fs": [
        { "id": "bafyghi4", "ts": "2026-03-06T14:00:00Z" }
      ]
    }
  }
}
```

Each target tracks an `fs` array of `{ id, ts }` entries — the fsIds it has been deployed with. Targets can also carry an `invite` object — the default permissions granted by invite links for that group.

- **`invite`** (optional) overrides the default permissions granted when the owner approves access requests. When omitted, the default is collaborative: `access: "write"`, `inviteWriter: true`. The owner can add an explicit `invite` object to lock down a group (e.g., `{ "access": "read", "inviteReader": true }`). Also controls the permissions on pre-approved instant access tokens (future).

- **`publish`** appends to `fs` history (newest first). Full history of what was pushed to this group.
- **`live`** replaces its single `fs` entry on each push — only the current state matters. Old fsIds are discarded as new ones arrive during the session.
- **Advisory, not authoritative.** The server is the source of truth. vibes.json is a local cache — two users (or workstations) authorized to push to the same target will have different `fs` histories depending on who pushed what from where. This is fine; it's a convenience for the CLI to show you what you've done, not a ledger of all deploys.
- **Bare group names** (e.g., `"work-lunch"`) resolve using the logged-in user + `vibes.json` app name: `jchris/coffee-order/work-lunch`
- **Fully-qualified targets** (e.g., `"jchris/soup-order/work-lunch"`) are used as-is — for deploying to a different app or another user's app (with permission)
- Targets are created on first use — `use-vibes publish picnic` creates the `picnic` target if it doesn't exist

### Target resolution

The CLI resolves targets by counting slashes:

| You type | Resolves to |
|---|---|
| `use-vibes publish` | `{whoami}/{app}/default` — the `default` group (no group segment in URL) |
| `use-vibes publish work-lunch` | `{whoami}/{app}/work-lunch` → `jchris/coffee-order/work-lunch` |
| `use-vibes publish jchris/soup-order/work-lunch` | `jchris/soup-order/work-lunch` (fully qualified, used as-is) |

The `default` group is special only in URL handling: browsing to a target without a group segment serves the `default` group. This gives the shortest shareable URL (e.g., `coffee-order--jchris.vibecode.garden` with no group in the path). All other groups require their name in the URL.

### Permissions

The full target path enables cross-user deployment:
- Joe can deploy to `jchris/foo-bar/amaze` if jchris grants permission
- Permissions are per-target, not per-app

---

## Two Verbs: `live` and `publish`

### `use-vibes live <group>` — Continuous push

Watches files, pushes every save to the target group. Anyone viewing that group sees live updates.

```bash
use-vibes live dev           # push live edits to dev group
use-vibes live work-lunch    # push live edits to work-lunch (risky — audience sees changes)
```

1. Requires `use-vibes login` (prompts if not logged in)
2. Watch `App.jsx` (and related files) for changes
3. On save: lint → push to target group
4. Group URL gets live updates immediately (SSE or version polling)
5. On lint failure: keep last-good version live, show error in terminal

**`use-vibes dev` is sugar for `use-vibes live dev`**. The `dev` group name signals "construction zone" — anyone in it expects instability.

Using `live` on a non-dev group is a conscious choice: your audience sees every save. Useful for demos, pair programming, or when you want someone watching over your shoulder.

### `use-vibes generate <slug> "prompt"` — AI create new vibe

Creates a new vibe file (`<slug>.jsx`) from a natural language prompt. The slug controls the filename and becomes the vibe's identity in vibes.json.

```bash
use-vibes generate my-app "build a sales dashboard"       # creates my-app.jsx
use-vibes generate todo "a collaborative todo list"        # creates todo.jsx
```

This enables **one directory, many vibes** — each `generate` call creates a new `slug.jsx` file, and vibes.json tracks all of them at the top level. Rapid-fire generation of lots of vibes from a single workspace.

Uses the same system prompt from `@vibes.diy/prompts` as the browser editor. If `live` is running, the new file triggers the watch → lint → push cycle automatically.

### `use-vibes edit <slug|file> "prompt"` — AI edit

Reads an existing vibe file, sends it to call-ai with the prompt, writes the result back. Streams the diff to stdout so you see what changed.

```bash
use-vibes edit my-app "make the header dark"       # edits my-app.jsx (by slug)
use-vibes edit my-app.jsx "add a search bar"       # edits by filename
```

If `live` is running in another terminal, the saved file triggers the normal watch → lint → push cycle automatically.

Pairs naturally with `live` for a full AI dev loop from the terminal:
```bash
# terminal 1: use-vibes dev
# terminal 2: use-vibes generate todo "a collaborative todo list"
#             use-vibes edit todo "add drag-and-drop reordering"
#             use-vibes edit todo "make it real-time collaborative"
```

### `use-vibes skills` — List available skills

Prints the skill catalog: name + description for each available skill. The descriptions are the same ones used by the RAG decision model in the browser — designed to help an LLM decide which skills to request.

```bash
$ use-vibes skills
fireproof   Local-first database with encrypted live sync
callai      Easy API for LLM requests with streaming support
image-gen   Generate and edit images
web-audio   Web Audio API fundamentals
d3          D3.js data visualization library
three-js    Three.js 3D graphics library
```

An agent can call `use-vibes skills`, read the descriptions, decide which ones are relevant to its task, then call `use-vibes system --skills fireproof,d3` to get the full system prompt. This is the same decision loop the browser does automatically via GPT-4o, but decomposed for CLI agents to control.

### `use-vibes system` — Emit system prompt

Echoes the full assembled system prompt to stdout for a given set of skills. This is the bridge for CLI users who bring their own AI tokens — they need the system prompt to feed to their own model calls.

```bash
use-vibes system                                    # default skills (fireproof, callai)
use-vibes system --skills fireproof,d3              # specific skills
use-vibes system --skills fireproof,three-js,callai # multiple skills
```

Available skills (from `@vibes.diy/prompts`):

| Slice | What it adds |
|---|---|
| `fireproof` | useFireproof docs (local-first DB) |
| `callai` | call-ai docs (LLM streaming) |
| `image-gen` | ImgGen component docs |
| `web-audio` | Web Audio API docs |
| `d3` | D3.js data visualization |
| `three-js` | Three.js 3D graphics |

Under the hood: loads the `.txt` documentation for each selected skill, wraps them in `<label-docs>` tags, and assembles the full system prompt via `makeBaseSystemPrompt()`. The output is piped directly to stdout so it can be composed:

```bash
# copy to clipboard for pasting into any AI tool
use-vibes system --skills fireproof,d3 | pbcopy

# save to file for use with any model client
use-vibes system --skills fireproof > .system-prompt.txt
```

**Note:** `call-ai` does not currently accept a system prompt file — `--src` means "read a saved stream from file (skip API call)." To use the system prompt with call-ai, pipe it or load it in your own wrapper. Adding a `--system` flag to call-ai is a natural future addition.

In the browser, vibes.diy owns the tokens and does RAG selection automatically (via a GPT-4o call that picks skills based on the user's prompt). In CLI land, the user picks skills explicitly because they're paying for their own tokens.

### `use-vibes publish [group]` — One-time push

Pushes current code to the target group once and exits. The group gets a stable snapshot.

```bash
use-vibes publish                  # deploy to 'default' group (shortest URL, no group segment)
use-vibes publish family-reunion   # deploy current code to family-reunion
use-vibes publish dev              # also works — one-time push to dev
```

---

## `use-vibes help` Output

The help text is designed to be read by both humans and agents. The agent workflow is at the top (most important) and repeated as a concrete example at the bottom.

```
use-vibes — build and deploy React + Fireproof apps

  Agent workflow:  skills → system → generate → live/publish
  Human workflow:  login → dev → edit → publish

Auth:
  login                      Device-code auth, stores credentials locally
  whoami                     Print the logged-in user (used as default owner)

Develop:
  dev                        Live-push to dev group (sugar for: live dev)
  live <group>               Watch files, push every save to target group
  generate <slug> "prompt"   AI-create a new vibe (slug.jsx)
  edit <slug|file> "prompt"  AI-edit an existing vibe, stream diff

Prompts:
  skills                     List available RAG skills with descriptions
  system [--skills ...]      Emit assembled system prompt to stdout

Deploy:
  publish [group]            One-time push to target group (default: 'default')
  invite <group> [flags]     (future) Generate a pre-approved instant access token
                             --reader, --ttl <minutes>

Targets:
  Bare name:      work-lunch             → {whoami}/{app}/work-lunch
  Fully qualified: jchris/app/group      → used as-is

Example — agent building an app from scratch:

  $ use-vibes skills                           # read skill catalog
  $ use-vibes system --skills fireproof,d3     # get system prompt
  $ use-vibes generate dashboard "sales dashboard"  # AI-create dashboard.jsx
  $ use-vibes dev                              # push to dev, get URL
  $ use-vibes publish demo                     # freeze for sharing
```

---

## Cloud-First: No Localhost

There is no local dev server. Every environment is a cloud deploy with HTTPS.

### Why

- No local HTTPS cert management
- No port conflicts
- Works from iPad, Chromebook, phone, SSH sessions, Codespaces
- Agent outputs are instantly shareable — the URL works for everyone
- No difference between "running" and "deploying"

### URLs

Target URLs use `appSlug--userSlug` (one double-dash):

```
https://coffee-order-work-lunch--jchris.vibecode.garden
       └───────appSlug──────────┘ └user┘
```

The CLI's three-part target (`owner/app/group`) resolves to `appSlug--userSlug` at the API boundary — `appSlug` absorbs both app identity and group name. The fsId lives in the path: `/~zFJwy...~/`.

---

## Agent-Native Build Tool

The CLI is designed to be invoked by AI agents, not just humans.

| Human workflow | Agent workflow |
|---|---|
| `npm create vibe "idea"` | Agent writes App.jsx directly |
| `npm start` → dev URL | `use-vibes dev` → dev URL |
| `use-vibes publish demo` → share link | `use-vibes publish demo` → return URL to orchestrator |

An agent in any framework (Claude Code, Agent SDK, OpenAI Agents, LangGraph) can go from generated code to deployed app in one command. The URL is immediately shareable — paste it in a PR, Slack message, or pass it to another agent for verification.

### Team workflows

- Agent A generates an app, runs `use-vibes dev`, gets a URL
- Agent A shares the dev URL with Agent B (or a human reviewer)
- Agent B opens the URL, verifies it works, provides feedback
- Agent A iterates — every save pushes live to the same dev URL
- When ready: `use-vibes publish staging` freezes a snapshot for wider review

---

## Command Reference

| Command | What it does |
|---|---|
| `npm create vibe` | Interactive scaffold |
| `npm create vibe "description"` | AI-generate App.jsx + scaffold |
| `use-vibes login` | Device-code auth flow, stores credentials locally |
| `use-vibes whoami` | Print the logged-in user (used as default owner) |
| `use-vibes dev` | Sugar for `use-vibes live dev` |
| `use-vibes live <group>` | Watch files, push every save to target group |
| `use-vibes generate <slug> "prompt"` | AI-create a new vibe (`slug.jsx`), register in vibes.json |
| `use-vibes edit <slug\|file> "prompt"` | AI-edit an existing vibe, stream diff to stdout |
| `use-vibes skills` | List available skills with descriptions (for LLM decision-making) |
| `use-vibes system [--skills ...]` | Emit assembled system prompt to stdout for given skills |
| `use-vibes publish [group]` | One-time push of current code to target group. No arg = `default` group (shortest URL) |
| `use-vibes invite <group> [flags]` | (Future) Generate a pre-approved instant access token with TTL. Default: writer + inviteWriter. Flags: `--reader`, `--ttl <minutes>`. Primary sharing is just the app URL — no CLI command needed. See [mvp-invites.md](mvp-invites.md) |

---

## Package Topology

```
npm registry
├── create-vibe        → runs via `npm create vibe`
│   └── scaffolds project with use-vibes as devDependency
└── use-vibes          → library (import) + CLI (bin)
    ├── import: React hooks, useFireproof, etc.
    └── bin: bin.ts → Node entrypoint (dnt adds shebang); Deno entrypoint is main.deno.ts

monorepo (existing)
├── use-vibes/pkg      → library + CLI entry points
│   ├── main.deno.ts   → Deno-first CLI entrypoint
│   ├── run-cli.ts     → shared cmd-ts routing + Result handling
│   ├── bin.ts         → Node entrypoint (compiled by dnt with shebang)
│   ├── build-npm.ts   → dnt build script (Deno-only)
│   ├── commands/      → one file per command + cli-output.ts
│   └── lib/           → config, api-client, auth (future)
└── (create-vibe)      → move from own repo into monorepo, fresh release (after use-vibes CLI is solid)
```

Architecture (see [cli-architecture.md](cli-architecture.md)):
- **Deno-first**: main.deno.ts is the primary CLI runtime
- **cmd-ts**: subcommand routing, option parsing, help generation
- **cement Result pattern**: all commands return `Result<void>`
- **Injectable CliOutput**: stdout/stderr functions for testability
- **No fs.\*Sync**: `fs/promises` only, including config loading
- **No chokidar**: native `fs/promises.watch` (Node 20+ recursive)
