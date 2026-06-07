# Testing vibes-diy mcp

Manual test script for the MCP server. Run from the worktree root.

## Prerequisites

```sh
# Must be logged in (prod)
npx vibes-diy login

# Build the CLI (MCP cmd needs compiled JS)
pnpm build
```

## 1. Smoke test — help output

```sh
node vibes-diy/cli/run.js mcp --help
```

Expected: shows `--app-slug`, `--handle`, `--api-url` options.

## 2. Start the MCP server and send raw JSON-RPC

The MCP server speaks JSON-RPC over stdin/stdout. Start it and paste messages directly.

```sh
node vibes-diy/cli/run.js mcp --app-slug pickathon-picker --handle og 2>/dev/null
```

Stderr shows `vibes-diy MCP server started` (redirected to /dev/null above so it doesn't mix with JSON-RPC).

### Initialize handshake

Paste this (the MCP protocol requires an initialize before any tool call):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": { "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": { "name": "test", "version": "0.1" } }
}
```

Then send initialized notification:

```json
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

### List available tools

```json
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }
```

Expected: 6 tools — `vibes_list_apps`, `vibes_list_databases`, `vibes_get`, `vibes_put`, `vibes_delete`, `vibes_query`.

### Call vibes_list_databases

```json
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "vibes_list_databases", "arguments": {} } }
```

Expected: JSON array of database names (e.g. `["pickathon-festival","picker"]`).

### Call vibes_query

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": { "name": "vibes_query", "arguments": { "field": "type", "db": "picker", "key": "\"favorite\"", "limit": 2 } }
}
```

Expected: JSON array of 2 favorite documents.

### Call vibes_get

Use a document ID from the query result above:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": { "name": "vibes_get", "arguments": { "id": "favorite-jchris-44319", "db": "picker" } }
}
```

Expected: the full document with `_id`, `type`, `userId`, etc.

### Call vibes_put (creates a test doc)

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "vibes_put",
    "arguments": { "doc": { "type": "mcp-test", "note": "hello from MCP", "ts": "2026-06-06" }, "db": "picker" }
  }
}
```

Expected: `{"id":"<generated-uuid>","ok":true}`.

### Call vibes_delete (clean up test doc)

Use the ID from the put result:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": { "name": "vibes_delete", "arguments": { "id": "<id-from-put>", "db": "picker" } }
}
```

Expected: `{"id":"<same-id>","ok":true}`.

### Call vibes_list_apps

```json
{ "jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": { "name": "vibes_list_apps", "arguments": {} } }
```

Expected: NDJSON-style array of all vibes with `ownerHandle`, `appSlug`, `title`.

Ctrl-C to exit.

## 3. Test with MCP Inspector (optional)

The MCP SDK ships an inspector UI:

```sh
npx @modelcontextprotocol/inspector node vibes-diy/cli/run.js mcp --app-slug pickathon-picker --handle og
```

Opens a browser UI where you can click tools and invoke them interactively.

## 4. Test against local dev (optional)

Requires local dev server running per [agents/local-cli-against-local-dev.md](../agents/local-cli-against-local-dev.md):

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
node vibes-diy/cli/run.js mcp \
  --app-slug test-app --handle jchris \
  --api-url "https://vite.localhost.vibesdiy.net:8888/api?.stable-entry.=cli"
```

## 5. Test in Claude Desktop (end-to-end)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pickathon": {
      "command": "node",
      "args": ["/absolute/path/to/vibes-diy/cli/run.js", "mcp", "--app-slug", "pickathon-picker", "--handle", "og"]
    }
  }
}
```

Restart Claude Desktop. Ask: "What databases are in this vibe?" — it should call `vibes_list_databases` and return the list.
