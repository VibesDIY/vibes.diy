## MCP Server Setup

Tools: vibes_list_apps, vibes_list_databases, vibes_get, vibes_put, vibes_delete, vibes_query

Requires: npx vibes-diy login (one time)

### Claude Desktop / Cowork

Add to ~/Library/Application Support/Claude/claude_desktop_config.json:

```json
{
  "mcpServers": {
    "my-vibe": {
      "command": "npx",
      "args": ["vibes-diy", "mcp", "--app-slug", "APP", "--handle", "USER"]
    }
  }
}
```

### Claude Code

Add to .claude/settings.json:

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

### Test interactively

    npx @modelcontextprotocol/inspector npx vibes-diy mcp --app-slug APP
