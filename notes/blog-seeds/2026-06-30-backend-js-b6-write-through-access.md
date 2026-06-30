# A backend write that the access function can't tell from a user write

Source: `claude/backend-js-b6-write-through-access` (B6 of #2856; the write/access core, follows B5's onChange)

B6 makes a vibe's `backend.js` `ctx.db.put(doc)` / `ctx.db.delete(id)` **real**. The headline is "handlers
can write data now." The actual work is making sure a server-side write is the *same write* a user makes —
same access gate, same allow/deny, same grant sidecar — so there's no privileged backdoor that bypasses
`access.js`. The access function literally cannot tell a backend write from a frontend one, because they
run the identical gate.

**The capability has to cross an isolate boundary without leaking.** `ctx.db.put` runs inside the
untrusted Worker Loader isolate; the gate runs on the host with the database handle. Three ways to bridge
it; only one survives. Route it through the isolate's general `fetch`? That couples the data path to B8's
egress proxy and makes the write capability reachable from any handler code. Return a list of writes the
host applies after the handler finishes? That breaks read-after-write *inside* a handler. The answer
(Charlie-confirmed) is a **dedicated, identity-free `Fetcher` binding in the isolate `env`** —
`env.__VIBES_DB`. The generated `ctx.db` is the *only* path to it; general `fetch` stays
`globalOutbound: null` until B8. So the write capability is unforgeable from handler code: you can't reach
it except through `ctx.db`.

**`env` is part of the isolate identity, so what you put there matters.** The isolate is cached by a hash
of its code. Bake per-trigger identity into `env` and either you fragment the cache (a new isolate per
user) or you bleed identity (a cached isolate serving the wrong writer). So `env` holds only the *stable
transport*; the identity and the loop-guard depth ride the host-side callback, never the binding. And the
binding *schema* version is folded into the isolate hash (Charlie watch-out) — change the `ctx.db` contract
and you force a fresh isolate, so a binding change can never be served stale.

**Put and delete are different gates — don't conflate them.** This bit Codex at the spec stage. `putDoc`
runs the access function (QuickJS), reduces grant state, fail-closes, and **upserts** the `AccessFnOutputs`
sidecar. `deleteDoc` does *none* of that — it runs ACL/DM checks and **removes** the stored output row
(that removal *is* the revocation). A backend write reuses whichever path matches the op, so allow/deny +
sidecar behavior is identical per-op. Both go through the exact same per-doc seq allocator the frontend
uses, so a handler write and a concurrent user write to the same doc still serialize on one writer — no
new ordering layer, Charlie's hard requirement.

**The loop guard finally has fuel.** B5 built a generation-depth guard and proved it dormant (handlers
couldn't write). B6 threads the *trusted* depth end-to-end: the onChange envelope's `depth` — carried since
B5 but dropped before the handler ran — now flows DO → onChange attempt → `ctx.db` callback →
`emitBackendOnChange`. A handler write at generation N emits its own onChange at N+1, suppressed past 4. The
depth never comes from handler input; it rides the same trusted internal channel as identity. The guard
B5 unit-tested against a *simulated* chain now bounds a real one.

**What's deliberately not here.** The session-user identity for the `fetch` trigger is *wired* but its
resolver returns null pending a confirmed `_api` verified-session scheme — so `fetch` handler writes are
anonymous (fail-safe: the access fn must opt them in) until a one-function follow-up. Live WS fan-out for
backend writes is deferred too — allow/deny + grant parity is exact; viewers are eventually consistent via
sync + the onChange lane. And the whole slice is dark behind `BACKEND_JS=off`: it's the risky write/access
path, so it merges dormant and the actual deploy is held for a human.
