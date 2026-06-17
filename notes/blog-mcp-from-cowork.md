# Give Cowork hands on your data: the `vibes-diy` MCP server

> Draft tech-stack post. Audience: people running [Claude Cowork](https://www.anthropic.com/) (and Claude Desktop) who already build vibes and now want their agent to *read and write the data inside them* — no shell, no glue code. Grounded in [`vibes-connect-mcp/spec.md`](../vibes-connect-mcp/spec.md) and the server in [`vibes-diy/cli/cmds/mcp-cmd.ts`](../vibes-diy/cli/cmds/mcp-cmd.ts).

## The gap: Cowork can build a vibe, but can't touch its data

A vibe is a tiny app with a live database behind it. Cowork is great at *writing the app* — but once it's deployed and accumulating documents, the agent goes blind. It can't see what's in the database, can't answer "how many signups today?", can't drop in a seed record so you can eyeball the UI. The data is right there; the agent just has no door into it.

Claude Code gets that door for free — it has a shell, so it can call the `vibes-diy` CLI directly. Cowork and Claude Desktop **have no shell**. Their only extension point is [MCP](https://modelcontextprotocol.io): tools exposed over stdio JSON-RPC. So that's exactly what `vibes-diy mcp` is — the same CLI data operations, wrapped as MCP tools an agent can call.

## Two minutes to wire it up

**1. Log in once** (on the same machine Cowork runs on). This enrolls a device certificate — no password, no token to paste:

```bash
npx vibes-diy login
```

**2. Point Cowork at the server.** Add one block to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

`--app-slug` and `--handle` pin the session to one vibe. Leave them off and the CLI defaults from `VIBES_APP_SLUG` (or the current directory) and your login — but for Cowork, naming them explicitly is the clear move.

**3. Restart Cowork.** Ask it *"What databases are in this vibe?"* — it calls `vibes_list_databases` and answers. That's the whole setup.

## What the agent can now do

Six tools, all backed by the same CLI internals you'd use by hand:

| Tool | What it does |
| --- | --- |
| `vibes_list_apps` | Page through your vibes (`limit`, `cursor`, `search`) |
| `vibes_list_databases` | List the databases inside the session's vibe |
| `vibes_get` | Fetch one document by `id` |
| `vibes_put` | Create or update a document |
| `vibes_delete` | Remove a document by `id` |
| `vibes_query` | Query a database by field — `key`, `prefix`, `range`, `limit`, `descending` |

Read-only tools (`list`, `get`, `query`) are tagged `readOnlyHint`; `put` and `delete` carry `destructiveHint`, so a careful client can gate writes behind a confirmation. The agent sees the difference.

`vibes_list_apps` is paginated on purpose. A single MCP response has to fit in the agent's context, so dumping every vibe you've ever made doesn't scale. It defaults to 50 items (max 200), takes a `cursor` to page, and a `search` substring to narrow by title or slug. Ask *"find my pickathon vibe"* and the agent passes `search: "pickathon"` instead of scrolling a wall of JSON.

## A worked example

You built `pickathon-picker` — a band-voting app for a festival. It's live, votes are coming in, and you want to make sense of them without opening a SQL console. In Cowork:

> **You:** Which bands are leading in pickathon-picker, and add a test vote for "The Wedges" so I can check the tally UI.

Under the hood the agent chains tool calls:

1. `vibes_list_databases` → finds the `picker` database.
2. `vibes_query` on the `votes` field → reads the current docs, tallies them, tells you the top three.
3. `vibes_put` `{ type: "vote", band: "The Wedges", ts: "…" }` → drops in your test record.
4. You refresh the app; the new vote is in the tally. When you're done: *"delete that test vote"* → `vibes_delete`.

No export, no copy-paste, no leaving the chat. The agent treats your live vibe data as a first-class thing it can reason over and nudge.

## Why this shape (and not a REST key)

The design choices are the interesting part:

- **One vibe per session, fixed at startup.** No per-call `appSlug` switching means the agent can't wander into the wrong app's data mid-conversation. The blast radius of any tool call is one vibe you chose deliberately.
- **Device cert, not an API key in the config.** Auth rides on the same `vibes-diy login` certificate the CLI already uses — the private key never enters the MCP config or the chat. Revoking the device kills MCP access too; there's no long-lived secret sitting in a JSON file.
- **Same internals as the CLI.** The MCP server isn't a parallel implementation — it wraps the exact operations Claude Code shells out to. One behavior to reason about, two transports.

## Open question — ideas wanted, @popmechanic 👋

The setup above is solid, but the **example needs to sing**. I want the canonical Cowork demo to make someone go "oh, I *need* that," not "neat, a CRUD wrapper." Some directions I'm weighing — would love your take on which lands hardest, and what you'd add:

- **Live ops on a real vibe:** "summarize today's signups," "find and delete spam entries," "export the leaderboard as markdown." Agent as a data concierge over your own app.
- **Seed-and-see loop:** agent writes fixture docs so you can QA UI states (empty / one item / overflowing) without hand-crafting JSON — tightening the build→inspect loop Cowork already owns.
- **Cross-vibe roll-up:** `vibes_list_apps` + per-vibe queries to answer "which of my apps got traffic this week?" — leaning on the new pagination/search.
- **Migration / cleanup:** "rename every `type: todo` doc to `type: task`" — bulk transforms a human would dread doing by hand.

Which of these is the most compelling hero example for the post? And is there a use case that shows off something *only* Cowork-plus-data unlocks — something the standalone app or the CLI can't do as naturally? Drop thoughts inline or in the PR.

## Takeaway

Cowork could already write the app. The MCP server closes the loop by letting it *operate on the running app's data* — read it, reason over it, change it — through six well-scoped tools, one login, and one config block. The work wasn't a new protocol; it was exposing the data surface the CLI already had to the one client that couldn't reach a shell.
