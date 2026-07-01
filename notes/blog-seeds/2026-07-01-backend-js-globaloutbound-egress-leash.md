# The egress leash you can't narrow with a plain object

**Hook:** We handed untrusted `backend.js` handler code a `globalOutbound` "leash" so its
`ctx.db` writes could re-enter the production access gate. Reviewing it, we found the leash also
exposed the Durable Object's control plane — then found that the obvious fix (wrap the stub to
allow only the db-op URL) *can't work*, because `globalOutbound` must be a **real Fetcher**, not a
plain object with a `fetch` method.

**Source:** `#2856` backend.js security review (PR #3021), right after `BACKEND_JS=loader` flipped on
in prod. Caught by Codex + Charlie review.

**The trade-off / why / gotcha:**

`globalOutbound` is the only by-reference channel a Worker Loader isolate gets, and it intercepts
**every** `fetch()` the handler makes — not just the nonce-gated `ctx.db` op we intended. We wired it
to a *bare* self-stub of the `BackendDO`. But that DO's `fetch` also dispatches control-plane ops
(`arm`/`onChange`) on an `x-backend-op` header — and the handler already knows the one thing that
gate checks: its own `{ownerHandle, appSlug}`, because we bake those into `ctx.appInfo`. So untrusted
code could POST a forged `onChange` poke through the leash with a spoofed `writerUserId` (identity)
and `depth: 0` (reset the `MAX_ONCHANGE_DEPTH` loop guard → amplification), scoped to its own vibe.

The tempting fix: wrap the stub so it forwards only the exact db-op URL. It even unit-tests green
against the fake loader. But the fake loader is structural — the **real** Worker Loader rejects a
plain `{ fetch }` object for `globalOutbound` (the capability boundary is brand-sensitive; a DO stub
or service binding is a real capability, a JS object isn't). So the wrapper would have made *every*
`ctx.db` write 404 in prod while looking correct in CI. Worse than the bug.

Two real levers remain, since the only thing the isolate provably lacks is **worker `env`** (its
`WorkerCode.env` is empty) and **any object reference** (it only gets the `fetch()` global):
1. **Move control-plane ops off `fetch` onto DO RPC methods** — the isolate can't invoke RPC through
   `globalOutbound`, only HTTP. Clean, but needs `extends DurableObject` (this repo's DOs all
   `implements` + `fetch`), so it's a base-class change we couldn't validate without live workerd.
2. **Authenticate the pokes at the DO with an env secret** the trusted worker/queue stamp and the
   isolate can't know. Robust, but the secret has to live in both the main worker and the
   queue-consumer deployments — real provisioning, so it's a follow-up, not a same-PR flip.

What shipped in this PR: the unambiguous half — stop forwarding the viewer's `Cookie`/`Authorization`
into handler code on the apex `/vibe/{o}/{s}/_api` form (webhook signature headers preserved) — plus
reverting the broken wrapper. The control-plane hardening (option 2, defense-in-depth) is a tracked
follow-up.

**Lesson:** a capability channel to "one method on an object" is really a channel to *the whole
object* — and you can't re-narrow it from the guest side with a plain object, because the capability
boundary only accepts real capabilities. Narrow at the **host receiver** (authenticate/authorize
there), not with a guest-side wrapper the runtime will reject. And a green test against a *fake*
binding proves shape, not that the *real* binding accepts your shape.
