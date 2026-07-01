# The flag was on, the gate was perfect, and two of three lanes were still dead

Source: `claude/backend-js-b6-write-through-access` (follow-up to #2946, the B6 ship)

First hour of backend.js live in prod. The fetch lane verified end-to-end on the
first real try — handler on a live edge isolate, `ctx.db.put` through the access
gate, doc persisted. Then the onChange mirror never arrived, and the 1-minute
scheduled heartbeat never ticked, and *everything checked out*: flag deployed,
LOADER binding in the worker's binding table, release row carrying `/backend.js`,
asset bytes readable, AppSettings registered.

The culprit was one absent stanza: the **queue consumer is its own worker**, and
its wrangler.toml never grew a `durable_objects` section. Both queue lanes
(`__backend_onchange`, `__backend_arm`) poke the vibe's `BackendDO` via
`params.cf?.BACKEND_DO` — optional by design, from B5's dark-mode contract:
*binding absent ⇒ ack silently*. Exactly right while the feature was dark (no
retry storms on envs without the DO), and exactly wrong the day the flag
flipped: the consumer swallowed every poke, at-least-once delivery became
at-least-once discard, and nothing logged.

Two lessons worth keeping. **A dark-mode "absent ⇒ ack" guard is a launch
checklist item, not just a guard** — every `cf?.X` optional in the consumer is a
binding someone must remember to add on go-live day (`USER_NOTIFY` sits in the
same pattern today). And **the worker that runs your code is not the worker
that delivers your events** — the main worker's binding table was audited to
death on the PR; nobody looked at the *consumer's* table because the consumer
didn't change.

The fix is eight lines of TOML (a cross-script `script_name` stub per env, main
worker deploys first so there's no 10061 ordering trap). The find was an hour of
live verification that no CI lane could have run: the open-beta loader binding
is absent from CI, and the queue only exists deployed.
