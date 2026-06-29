# Why the handler name rides the request, not the isolate's hash

Source: `claude/backend-js-b1-executor-seam` (B1 of #2856; follows the design PR #2859)

Building the first slice of per-app `backend.js`, the obvious move was to mirror SSR's
`buildVibeWorkerCode` one-to-one: shape a Worker Loader `WorkerCode`, hash it, `env.LOADER.get(id, …)`.
But @CharlieHelps's review of the design surfaced the load-bearing invariant — `loader.get(id)` keys
the isolate cache on `compatibilityDate + mainModule + JSON.stringify(modules)`, **and** `WorkerCode.env`
is part of that identity — so anything per-trigger (the acting `userHandle`, secrets, the request) that
leaks into the hashed code or `env` either forks the isolate per call or, worse, lets one trigger's
identity bleed into another's reused isolate. The fix that falls out is almost too simple: bake **nothing**
per-trigger into the code — not even the *handler name*. The generated `main` module reads
`{ handler, trigger }` off the request body on every invocation and dispatches `handlers[handler](...)`.
The payoff is that `fetch`, `scheduled`, and `onChange` for a given vibe — across every user — all share
**one** isolate, because the only things in the hash are the vibe's `backend.js` bytes and a
`policyVersion` (so an egress-policy bump still forces a fresh isolate). Three things worth a post: (1)
the counterintuitive "put *less* in the cache key to get *more* reuse" move, and how it inverts the
instinct to specialize a worker per handler; (2) testing a security invariant you can't yet run live —
the `env.LOADER` binding is beta and absent from CI, so the acceptance matrix asserts against a *fake*
binding (same code + different identities ⇒ same id; identity present in the request but never in the
hashed `WorkerCode`; policy bump ⇒ new id); and (3) the discipline of shipping a whole feature dormant
behind `BACKEND_JS=off` with **no `node` mode at all** — because a secret-bearing, network-capable handler
must never have an in-process execution path, the lesson SSR learned from a real Codex-caught RCE.
