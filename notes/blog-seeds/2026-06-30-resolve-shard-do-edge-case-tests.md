# `resolveShardDO` edge cases: the first colon is the only delimiter

- **Branch / PR:** `claude/issue-2264-status-aj8oxw` — #2264 follow-up cleanup
- **Hook:** A DO router that turns a registered `shardId` into a physical DO name
  has exactly one parsing rule that matters — *which* colon splits the prefix —
  and two inputs probe it: `app:foo:bar` (a known prefix with a multi-colon
  suffix) and `app:` (a known prefix with an empty suffix). Both must keep the
  full id verbatim as the physical name, or fan-out silently routes to the wrong
  instance.

## The trade-off / why

`resolveShardDO` (`pkg/workers/resolve-shard-do.ts`) splits on
`shardId.indexOf(":")` — the *first* colon — looks up the prefix in a frozen
`app:`/`shared:` binding table, and on a hit returns the **entire** original id
as the physical name (it must stay byte-identical to the string `app.ts` feeds
`idFromName`). The existing suite covered `app:foo`, `foo`, and `foo:bar` but
left the two cases that actually exercise the "first colon only" rule untested:

- `app:foo:bar` → `SESSIONS`, name kept as `app:foo:bar` (the suffix's own colon
  is *not* a second delimiter).
- `app:` → `SESSIONS`, name `app:` (empty suffix still binds on the prefix, so it
  can't collide with a bare codegen `app` → `codegen:app`).

These were the last two unchecked edge cases on #2264; the issue's other two
cleanup items (the stale `?shard=` on `/api/app`, the dead notify-callback
comments) had already been resolved by intervening DO-collapse work, so this PR
just locks in the remaining behavior with tests.

## Gotcha worth a post

"Add edge-case tests" reads as busywork until you notice the load-bearing
constants: the prefixes are frozen on-the-wire strings pinned to persisted
UserNotify registrations across the #2714 plane collapse. A test that asserts
`app:` stays `app:` isn't pedantry — it's a tripwire against a future "clean up
the trailing colon" refactor that would split the fan-out without failing any
existing test.
