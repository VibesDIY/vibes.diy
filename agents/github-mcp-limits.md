# GitHub MCP limits & workarounds

Notes on GitHub MCP tools whose raw output is awkward for agent sessions, and the
slim alternatives we provide.

## `actions_list` / `list_workflow_runs` — use `scripts/gh-runs.sh`

`mcp__github__actions_list` with `method: list_workflow_runs` returns the raw
GitHub API payload — full run objects, ~400KB on one line for this repo. That
exceeds the agent tool-result token cap, gets spilled to a file, and the
single-line formatting defeats `Read`'s offset/limit. All to answer "did the
deploy for commit X finish?", which needs only `head_sha`, `name`, `status`,
`conclusion`, `event`, `created_at`, `html_url`. (VibesDIY/vibes.diy#2640.)

**You don't have to remember this.** A `PreToolUse` hook
([`actions-list-redirect.cjs`](../.claude/skills/autoresearch/hooks/actions-list-redirect.cjs),
wired in [`.claude/settings.json`](../.claude/settings.json)) intercepts that
exact call and denies it with a message naming the alternative below. The hook is
scoped to `list_workflow_runs` only — every other `actions_list` method passes
through untouched. To bypass it deliberately, set
`AR_DISABLE_ACTIONS_LIST_REDIRECT=1`.

The alternative is [`scripts/gh-runs.sh`](../scripts/gh-runs.sh), which projects
runs down to those slim fields. Two modes, because what works depends on the
session:

- **Cloud agent session** (no `gh` CLI; direct GitHub REST is gated by the org
  egress policy — a shell can't fetch Actions data here). You can't avoid the raw
  fetch, so contain it: either delegate the MCP call to a subagent that returns
  only the slim fields, or call the MCP tool, let the ~400KB result spill to a
  file, and project that file — no token needed:

  ```
  scripts/gh-runs.sh --from-file <spilled-file-path>      # add --json for JSON
  ```

- **Local/dev shell with real GitHub auth** (`gh` CLI or a permitted token):

  ```
  scripts/gh-runs.sh --branch <branch>      # or --sha <sha>
  scripts/gh-runs.sh --per-page <n> --repo <owner/repo> --json
  ```

### Why not just "alias" the MCP tool to the wrapper?

`mcp__github__actions_list` is served by GitHub's official MCP server — not our
code — so we can't add field projection to it, and Claude Code has no mechanism
to silently swap a tool's implementation. A `PreToolUse` hook can *deny and
redirect* (the deny reason is fed back to the caller) but can't *substitute* slim
output in place of the tool. The hook + wrapper above is the closest thing to an
alias the platform allows: mechanical enforcement, self-documenting at the call
site, no reliance on anyone having read this file.
