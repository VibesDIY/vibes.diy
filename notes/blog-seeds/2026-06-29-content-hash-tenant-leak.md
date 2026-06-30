# When a content-addressed cache key quietly becomes a tenant boundary

Source: `claude/backend-js-per-vibe-isolate-scoping` (design note for #2856)

Designing per-app `backend.js`, we key the Cloudflare Worker Loader isolate on a SHA of the worker
code — identical code reuses one warm isolate. Clean and content-addressed. Then a question surfaced:
two *different* vibes (different owners) with byte-identical `backend.js` hash to the same id — should
they share an isolate? The seductive answer is "yes, free efficiency" (remix fleets!), and the hash
*already* does it by accident. The correct answer is "no, by default" — because a reused isolate keeps
**mutable module-level state** across invocations, so a leaky author global (`let cache = ctx.secrets.X`
at module scope) is harmless within one vibe (your own data → yourself) but becomes a **cross-tenant
secret leak** the instant the isolate is shared across owners. So the content hash, which looks like a
pure performance knob, is silently also the tenant-isolation boundary — and we fold `{ownerHandle,
appSlug}` into the key to make "one isolate per (vibe, code, policy)" the default. Worth a post: (1)
the general trap that content-addressed reuse and security isolation are the *same* key, so "dedupe
identical things" can erase a trust boundary; (2) the real efficiency prize (remix/template fleets) and
why you can still earn it later — but only behind a static "no mutable module state" proof or
trusted-platform-code restriction, never off a bare hash; and (3) the tell that within-tenant vs
cross-tenant sharing have *identical mechanics but opposite risk*, which is exactly when a default
needs to be conservative.
