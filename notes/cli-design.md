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
use-vibes invite work-lunch       # generate join link for a group
use-vibes edit "make the header dark"          # AI-edit App.jsx (default file)
use-vibes edit Nav.jsx "add a search bar"      # AI-edit a specific file
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

Each target tracks an `fs` array of `{ id, ts }` entries — the fsIds it has been deployed with.

- **`publish`** appends to `fs` history (newest first). Full history of what was pushed to this group.
- **`live`** replaces its single `fs` entry on each push — only the current state matters. Old fsIds are discarded as new ones arrive during the session.
- **Advisory, not authoritative.** The server is the source of truth. vibes.json is a local cache — two users (or workstations) authorized to push to the same target will have different `fs` histories depending on who pushed what from where. This is fine; it's a convenience for the CLI to show you what you've done, not a ledger of all deploys.
- **Bare group names** (e.g., `"work-lunch"`) resolve using the logged-in user + `vibes.json` app name: `jchris/coffee-order/work-lunch`
- **Fully-qualified targets** (e.g., `"jchris/soup-order/work-lunch"`) are used as-is — for deploying to a different app or another user's app (with permission)
- Targets are created on first use — `use-vibes publish picnic` creates the `picnic` target if it doesn't exist

### Target resolution

The CLI resolves targets by counting slashes:

| You type | Slashes | Resolves to |
|---|---|---|
| `use-vibes publish work-lunch` | 0 | `{whoami}/{app}/work-lunch` → `jchris/coffee-order/work-lunch` |
| `use-vibes publish jchris/soup-order/work-lunch` | 2 | `jchris/soup-order/work-lunch` (fully qualified, used as-is) |

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

### `use-vibes edit [file] "prompt"` — AI edit

Reads the file (defaults to `App.jsx`), sends it to call-ai with the prompt, writes the result back. Streams the diff to stdout so you see what changed.

```bash
use-vibes edit "make the header dark"              # edits App.jsx
use-vibes edit components/Nav.jsx "add search bar" # edits a specific file
```

Uses the same system prompt from `@vibes.diy/prompts` as the browser editor. If `live` is running in another terminal, the saved file triggers the normal watch → lint → push cycle automatically.

Pairs naturally with `live` for a full AI dev loop from the terminal:
```bash
# terminal 1: use-vibes dev
# terminal 2: use-vibes edit "add a shopping cart sidebar"
#             use-vibes edit "make cart totals update in real time"
```

### `use-vibes slices` — List available slices

Prints the slice catalog: name + description for each available slice. The descriptions are the same ones used by the RAG decision model in the browser — designed to help an LLM decide which slices to request.

```bash
$ use-vibes slices
fireproof   Local-first database with encrypted live sync
callai      Easy API for LLM requests with streaming support
image-gen   Generate and edit images
web-audio   Web Audio API fundamentals
d3          D3.js data visualization library
three-js    Three.js 3D graphics library
```

An agent can call `use-vibes slices`, read the descriptions, decide which ones are relevant to its task, then call `use-vibes system --slices fireproof,d3` to get the full system prompt. This is the same decision loop the browser does automatically via GPT-4o, but decomposed for CLI agents to control.

### `use-vibes system` — Emit system prompt

Echoes the full assembled system prompt to stdout for a given set of slices. This is the bridge for CLI users who bring their own AI tokens — they need the system prompt to feed to their own model calls.

```bash
use-vibes system                                    # default slices (fireproof, callai)
use-vibes system --slices fireproof,d3              # specific slices
use-vibes system --slices fireproof,three-js,callai # multiple slices
```

Available slices (from `@vibes.diy/prompts`):

| Slice | What it adds |
|---|---|
| `fireproof` | useFireproof docs (local-first DB) |
| `callai` | call-ai docs (LLM streaming) |
| `image-gen` | ImgGen component docs |
| `web-audio` | Web Audio API docs |
| `d3` | D3.js data visualization |
| `three-js` | Three.js 3D graphics |

Under the hood: loads the `.txt` documentation for each selected slice, wraps them in `<label-docs>` tags, and assembles the full system prompt via `makeBaseSystemPrompt()`. The output is piped directly to stdout so it can be composed:

```bash
# use with any AI tool
use-vibes system --slices fireproof,d3 | pbcopy
use-vibes system --slices fireproof > .system-prompt.txt

# pipe to your own model call (requires call-ai --src flag for system prompt file)
use-vibes system --slices fireproof > .system-prompt.txt && call-ai --src .system-prompt.txt --prompt "build a todo app"
```

In the browser, vibes.diy owns the tokens and does RAG selection automatically (via a GPT-4o call that picks slices based on the user's prompt). In CLI land, the user picks slices explicitly because they're paying for their own tokens.

### `use-vibes publish <group>` — One-time push

Pushes current code to the target group once and exits. The group gets a stable snapshot.

```bash
use-vibes publish family-reunion   # deploy current code to family-reunion
use-vibes publish dev              # also works — one-time push to dev
```

---

## `use-vibes help` Output

The help text is designed to be read by both humans and agents. The agent workflow is at the top (most important) and repeated as a concrete example at the bottom.

```
use-vibes — build and deploy React + Fireproof apps

  Agent workflow:  slices → system → edit → live/publish
  Human workflow:  login → dev → edit → publish

Auth:
  login                      Device-code auth, stores credentials locally
  whoami                     Print the logged-in user (used as default owner)

Develop:
  dev                        Live-push to dev group (sugar for: live dev)
  live <group>               Watch files, push every save to target group
  edit [file] "prompt"       AI-edit a file (default: App.jsx), stream diff

Prompts:
  slices                     List available RAG slices with descriptions
  system [--slices ...]      Emit assembled system prompt to stdout

Deploy:
  publish <group>            One-time push of current code to target group
  invite <group>             Generate a join link for a group

Targets:
  Bare name:      work-lunch             → {whoami}/{app}/work-lunch
  Fully qualified: jchris/app/group      → used as-is

Example — agent building an app from scratch:

  $ use-vibes slices                           # read slice catalog
  $ use-vibes system --slices fireproof,d3     # get system prompt
  $ use-vibes edit "build a sales dashboard"   # AI-generate App.jsx
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

Target URLs encode the full target path:

```
https://jchris--coffee-order--work-lunch.vibecode.garden
       └owner─┘ └───app────┘ └─group──┘
```

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
| `use-vibes edit [file] "prompt"` | AI-edit a file (default: App.jsx), stream diff to stdout |
| `use-vibes slices` | List available slices with descriptions (for LLM decision-making) |
| `use-vibes system [--slices ...]` | Emit assembled system prompt to stdout for given slices |
| `use-vibes publish <group>` | One-time push of current code to target group |
| `use-vibes invite <group>` | Generate a join link for a group |

---

## Package Topology

```
npm registry
├── create-vibe        → runs via `npm create vibe`
│   └── scaffolds project with use-vibes as devDependency
└── use-vibes          → library (import) + CLI (bin)
    ├── import: React hooks, useFireproof, etc.
    └── bin: cli.ts (tsx shebang, process.argv router)

monorepo (existing)
├── use-vibes/pkg      → library + new bin entry point
│   ├── cli.ts         → shebang entry, argv router
│   ├── commands/      → one file per command
│   └── lib/           → config, api-client, auth
└── (create-vibe)      → move from own repo into monorepo, fresh release (after use-vibes CLI is solid)
```

Architecture constraints (see [cli-architecture.md](cli-architecture.md)):
- **Build-free**: tsx runs TypeScript directly, no compile step
- **No cmd-ts**: process.argv + tiny router, each command parses its own args
- **No fs.\*Sync**: `fs/promises` only, including config loading
- **No chokidar**: native `fs/promises.watch` (Node 20+ recursive)
