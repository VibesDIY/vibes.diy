# vibes-connect-mcp — Spec

MCP server that gives Claude Desktop (Cowork) read/write access to Fireproof databases via the `use-vibes` package.

## Problem

Claude can talk about your app's data but can't touch it. An MCP server bridges that gap — Claude discovers database tools automatically, and the user approves each operation.

## Architecture

```
Claude Desktop / Cowork
  ↕ stdio (JSON-RPC over stdin/stdout)
vibes-connect-mcp (Node.js process)
  ↕ use-vibes fireproof() factory
Fireproof cloud (WebSocket sync)
```

- **Transport:** stdio — Claude launches the server as a subprocess
- **Auth:** device certificates from `npx vibes-diy login` (resolved automatically by `use-vibes`)
- **SDK:** `@modelcontextprotocol/sdk` (McpServer + StdioServerTransport)
- **Database:** `use-vibes` `fireproof(dbName, { appSlug })` — singleton-cached, safe to call per-invocation

## Tools

Four MCP tools mapping 1:1 to Fireproof CRUD:

| Tool | Method | destructiveHint | idempotentHint | Description |
|------|--------|-----------------|----------------|-------------|
| `fireproof_put` | `db.put(doc)` | true | false | Store or update a document |
| `fireproof_get` | `db.get(id)` | false | true | Retrieve a document by ID |
| `fireproof_delete` | `db.del(id)` | true | false | Delete a document by ID |
| `fireproof_query` | `db.query(field, opts)` | false | true | Query documents by field value |

All tools accept `dbName` and `appSlug` as parameters so Claude can work across multiple databases/apps in one session.

### Input schemas (Zod)

```
fireproof_put:    { dbName: string, appSlug: string, doc: Record<string, unknown> }
fireproof_get:    { dbName: string, appSlug: string, id: string }
fireproof_delete: { dbName: string, appSlug: string, id: string }
fireproof_query:  { dbName: string, appSlug: string, field: string, key?: string, range?: [string, string] }
```

### Return format

All tools return `{ content: [{ type: "text", text: JSON.stringify(result) }] }`.

## What's NOT in v1

- **Real-time subscriptions** — MCP resource subscriptions use a notify-then-re-read pattern that doesn't map cleanly to Fireproof's push-based `subscribe()`. A `fireproof_query` tool called on-demand is simpler and sufficient for now.
- **Schema introspection** — no auto-generated tools from document shapes. The four CRUD tools cover all operations.
- **Remote transport** — stdio only. Streamable HTTP can be added later for remote/serverless hosting.
- **Multi-user** — the server runs under the OS user who ran `npx vibes-diy login`. No multi-tenant auth.

## Open questions

1. **Folder placement** — should this live at repo root (`vibes-connect-mcp/`) or inside an existing package like `use-vibes/mcp/`?
2. **Package identity** — standalone npm package (`vibes-connect-mcp`) or part of the `use-vibes` distribution?
3. **allDocs / list tool** — should we add a `fireproof_list` tool that returns all documents (paginated), or is `fireproof_query` sufficient?
4. **Database discovery** — should the server auto-discover databases the user has access to, or require explicit `dbName` + `appSlug` on every call?
5. **Changes feed** — worth adding a `fireproof_changes` tool that returns recent changes since a sequence number, even without full subscriptions?
6. **Claude Code config** — Claude Code uses `.claude/settings.json` for MCP servers, not `claude_desktop_config.json`. Should the README cover both?

## Claude Desktop config

```json
{
  "mcpServers": {
    "vibes-data": {
      "command": "node",
      "args": ["/path/to/vibes-connect-mcp/server.js"]
    }
  }
}
```

## Dependencies

- `@modelcontextprotocol/sdk` (v1.x — v2 split packages expected Q3 2026)
- `use-vibes`
- `zod`

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Build Server Tutorial](https://modelcontextprotocol.io/docs/develop/build-server)
- [MCP Transport Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Vibes Connect docs](https://good.vibes.diy/vibes-connect)
- [Fireproof API](https://use-fireproof.com/docs/database-api/basics/)
