# Vibes Connect — Agent Data Access Spec

Give AI agents read/write access to vibe data. Two distribution surfaces — a Claude Code skill (Bash + CLI) and an MCP server (`vibes-diy mcp`) for Desktop/Cowork — backed by the same CLI internals.

## Problem

Agents can build vibes but can't read or write the data inside them. The `vibes-diy` CLI already has a complete data surface (`db list`, `db get`, `db put`, `db del`, `db query`, `db subscribe`). What's missing is the glue that lets agents discover and use it.

## Existing CLI surface

```
vibes-diy list --json                              # list all vibes (NDJSON)
vibes-diy db list   --app-slug X --handle Y     # list databases in a vibe
vibes-diy db get    --app-slug X --handle Y --db Z <id> --json
vibes-diy db put    --app-slug X --handle Y --db Z <json>
vibes-diy db del    --app-slug X --handle Y --db Z <id>
vibes-diy db query  --app-slug X --handle Y --db Z <field> [--key K] [--limit N] --json
vibes-diy db subscribe --app-slug X --handle Y --db Z
```

Auth is handled by device certificates from `npx vibes-diy login`. The `--app-slug` and `--handle` default from `VIBES_APP_SLUG` env var or `basename(cwd)` and user settings respectively.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              vibes-diy CLI internals             │
│   (use-vibes → Firefly cloud via WebSocket)      │
└──────────┬──────────────────────┬────────────────┘
           │                      │
    ┌──────┴──────┐       ┌───────┴───────┐
    │  Bash/Shell │       │ stdio MCP     │
    │  (CLI args) │       │ (JSON-RPC)    │
    └──────┬──────┘       └───────┬───────┘
           │                      │
    ┌──────┴──────┐       ┌───────┴───────┐
    │ Claude Code │       │ Cowork /      │
    │ skill       │       │ Desktop /     │
    │             │       │ any MCP client│
    └─────────────┘       └───────────────┘
```

One set of operations, two transports. The skill teaches Claude Code to shell out; the MCP server wraps the same internals in stdio JSON-RPC for environments without shell access.

## Phase 1: Claude Code skill

A skill file that teaches agents how to use the CLI for data operations. No new code — just documentation that Claude Code loads when working with vibe data.

The skill covers:

- Listing vibes and databases
- CRUD operations with `--json` output
- How `--app-slug` / `--handle` default from cwd and login state
- When to use `db subscribe` for tailing changes

This works today for any Claude Code agent (CLI, IDE extensions, Agent SDK).

## Phase 2: `vibes-diy mcp` subcommand

A new CLI subcommand that starts an MCP server over stdio, exposing the same data operations as tools. This is the required interface for Claude Desktop / Cowork, which has no shell access.

### Startup

```sh
npx vibes-diy mcp                                          # defaults from cwd + login
npx vibes-diy mcp --app-slug pickathon-picker --handle og  # explicit
VIBES_APP_SLUG=pickathon-picker npx vibes-diy mcp            # env var
```

The `ownerHandle/appSlug` is fixed for the session — resolved at startup from args, env, or cwd. No per-call switching.

### MCP tools

| Tool                   | CLI equivalent                      | destructiveHint | idempotentHint |
| ---------------------- | ----------------------------------- | --------------- | -------------- |
| `vibes_list_apps`      | `vibes-diy list --json`             | false           | true           |
| `vibes_list_databases` | `vibes-diy db list --json`          | false           | true           |
| `vibes_get`            | `vibes-diy db get <id> --json`      | false           | true           |
| `vibes_put`            | `vibes-diy db put <json>`           | true            | false          |
| `vibes_delete`         | `vibes-diy db del <id>`             | true            | false          |
| `vibes_query`          | `vibes-diy db query <field> --json` | false           | true           |

### Input schemas

```
vibes_list_apps:       {}
vibes_list_databases:  {}
vibes_get:             { db: string, id: string }
vibes_put:             { db: string, doc: Record<string, unknown> }
vibes_delete:          { db: string, id: string }
vibes_query:           { db: string, field: string, key?: string, prefix?: string,
                         range?: [string, string], limit?: number, descending?: boolean }
```

No `appSlug` or `userSlug` in tool schemas — they're session-level, set at startup.

### Return format

All tools return `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

### Client config

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-vibe": {
      "command": "npx",
      "args": ["vibes-diy", "mcp", "--app-slug", "pickathon-picker", "--handle", "og"]
    }
  }
}
```

Claude Code (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "my-vibe": {
      "command": "npx",
      "args": ["vibes-diy", "mcp"]
    }
  }
}
```

### Implementation

The MCP server is thin plumbing — `@modelcontextprotocol/sdk` McpServer + StdioServerTransport, calling the same internal functions the CLI commands use. Lives in the `vibes-diy` package (not a separate package), registered as a subcommand alongside `login`, `push`, `generate`, etc.

## What's NOT in v1

- **Real-time subscriptions via MCP** — MCP resource subscriptions use notify-then-re-read, which doesn't map to Firefly's push model. The CLI `db subscribe` works for Claude Code agents; Cowork gets poll-via-query for now.
- **Remote transport** — stdio only. Streamable HTTP for remote hosting is a later concern.
- **Multi-app sessions** — one `ownerHandle/appSlug` per server process. Run multiple MCP server entries for multiple apps.
- **Schema introspection** — no auto-generated tools from document shapes.

## Build order

1. Skill (teaches Claude Code agents the CLI commands — no code changes)
2. `vibes-diy mcp` subcommand (thin MCP wrapper for Cowork/Desktop)
3. Iterate tool surface based on real agent usage patterns

## Dependencies (Phase 2 only)

- `@modelcontextprotocol/sdk` (v1.x)
- `zod` (already in repo)

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Build Server Tutorial](https://modelcontextprotocol.io/docs/develop/build-server)
- [MCP Transport Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Vibes Connect docs](https://good.vibes.diy/vibes-connect)
- [vibes-diy CLI help](vibes-diy --help)
- [fireproof-storage/mcp-database-server](https://github.com/fireproof-storage/mcp-database-server) (prior art, demo-level)
