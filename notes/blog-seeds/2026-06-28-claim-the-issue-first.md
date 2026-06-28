# Self-assign the issue before you touch a line of it

Source: claude/self-assign-issues-nhop1d (CLAUDE.md + agents/pr-lifecycle.md)

Multiple agent sessions can be pointed at the same backlog. When two of them
get "work on #123" minutes apart, both branch, both code, and one of them is
throwing away a session's worth of work the moment the second PR opens. The
cheap insurance is a lock that costs one API call: self-assign the issue to
`jchris` as *step zero* — before investigating, before branching, before any
code — so the assignee field is the at-a-glance "someone's on it" signal the
next session checks.

The trade-off worth naming: it's tempting to fold the assign into "later, once
I've confirmed it's real work." That defeats the point. The window you're
guarding against duplicate effort in is exactly the investigation phase, so the
lock has to come *first*, while you still don't know if the issue is tractable.
An assigned issue that turns out to be a no-op is trivially un-assigned; two
parallel branches on the same fix are not.

Gotcha for the memory layer: this repo's "memory is repo-backed" rule means the
substance can't live only in CLAUDE.md — it goes in `agents/pr-lifecycle.md`
(the issue→PR lifecycle doc) with CLAUDE.md carrying a one-line pointer. The
assign itself is the GitHub MCP `issue_write` tool with the `assignees` field,
scoped to `VibesDIY/vibes.diy`.
