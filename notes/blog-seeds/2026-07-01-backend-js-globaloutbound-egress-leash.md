# The egress leash that leaked the control plane

**Hook:** We handed untrusted `backend.js` handler code a `globalOutbound` "leash" so its
`ctx.db` writes could re-enter the production access gate — and accidentally left the whole
Durable Object's control plane hanging off the other end of that leash.

**Source:** `#2856` backend.js security review, right after `BACKEND_JS=loader` flipped on in prod.

**The trade-off / why / gotcha:**

`globalOutbound` is the only by-reference channel a Worker Loader isolate gets, and we used it as
the transport for `ctx.db` ops (a nonce-gated POST to `https://db.internal/op`). The subtle part:
`globalOutbound` intercepts **every** `fetch()` the handler makes, not just the ones we intended.
We wired it to a *bare* self-stub of the BackendDO. But that DO's `fetch` also dispatches
control-plane ops (`arm`/`onChange`) — gated only by an `x-backend-op` header. And the handler
already knows the one secret that gate checks: its own `{ownerHandle, appSlug}`, because we bake
those into `ctx.appInfo` for exactly the "unspoofable" property we wanted elsewhere.

So untrusted code could `fetch("https://internal/__backend_onchange", { headers: {...}, body })`
through the leash and forge an onChange poke with an attacker-controlled `writerUserId` (identity
spoof) and `depth: 0` (reset the `MAX_ONCHANGE_DEPTH` loop guard → unbounded amplification). The
db-op path was nonce-gated; the control-plane ops assumed a trusted caller that no longer existed
once the isolate shared the same channel.

Fix: the stub the isolate sees is now a narrow wrapper (`narrowIsolateDbEgress`) that forwards
**only** the exact db-op URL and refuses everything else. Legit pokes come from the worker/queue via
a separate, unwrapped stub, so they're untouched. Same review also stopped forwarding the viewer's
`Cookie`/`Authorization` headers into handler code on the apex `/vibe/{o}/{s}/_api` form — identity
belongs host-side (`ctx.userInfo`), never in raw client headers the handler can read.

Lesson: a capability channel to "one method on an object" is really a channel to *the whole object*.
When the sandbox boundary is a single `fetch`, the URL allowlist **is** the boundary — enumerate it
explicitly, don't assume the callee's header checks will hold against a caller you just moved inside
the trust boundary.
