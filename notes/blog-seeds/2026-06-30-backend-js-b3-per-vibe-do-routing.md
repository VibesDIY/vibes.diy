# Routing untrusted server code to a per-vibe isolate — the addressing problem

Source: `claude/backend-js-b3-api-routing` (B3 of #2856; follows B2b's `active.backend` discovery)

B3 wires the synchronous request path for per-app `backend.js`: an HTTP request to a vibe's reserved
`_api` prefix reaches that vibe's `fetch` handler, running in a Cloudflare Worker Loader isolate, and
the handler's `Response` flows back verbatim. The interesting part isn't the isolate (B1 built that) —
it's the **addressing**: getting the request to the *right vibe's* compute with the *right code* and a
*tenant boundary* that holds.

Three things worth a post, each a place where the obvious version is subtly wrong:

1. **The request arrives by two doors.** A webhook (Stripe, OAuth) hits the *published* host
   `{slug}--{owner}.{base}/_api/...`; a logged-in viewer hits `/vibe/{owner}/{slug}/_api/...`. The first
   draft only matched the viewer path — but `routeDecision` sends the whole published subdomain to
   `cf-serve` *before* it ever sees the path, so every webhook would have 404'd as a static file. Codex
   caught this at the spec stage. The fix: a `backend-api` route decided *before* the subdomain branch,
   covering both forms, each resolving the same `(owner, slug)`.

2. **The gate and the code must come from the same release.** B2b stores a per-app `active.backend`
   entry ("does this vibe declare a `fetch` handler?"), but that entry is keyed by app, not by *release*
   — it tracks the latest push. The runtime, though, serves a *specific* release (production for a
   published vibe). Gate on the entry and you can 404 a perfectly good production backend right after a
   dev push, or spin an isolate for a dev-only handler against production source. The fix: derive *both*
   the gate and the source from one `selectLatestAppPerSlug` row — parse the release you're about to run.

3. **Identical code is not the same tenant.** The isolate cache keys on a hash of the code. Two vibes
   with byte-identical `backend.js` would therefore *share an isolate* — but they have different secrets,
   different write identity, different egress. So B3 folds `{ownerHandle, appSlug}` into the hashed
   isolate source (and the DO's physical name), with length-prefixed/JSON encoding so `("ab","c")` and
   `("a","bc")` can't alias. Per-trigger identity still rides the request, never the hash — one isolate
   serves all of one vibe's calls, zero of another's.

Plus a smaller architectural note: the heavy logic (`attemptBackendFetch`) lives in `api-svc` as a
never-throw, unit-testable function (real pushed vibe + fake loader binding); the Durable Object is a
thin shell that builds its SQL/storage ctx from `env` and calls it. That split is what let B3 ship with
~38 fast tests and no Durable-Object test harness — and it's the seam B4 (alarms) and B5 (`onChange`)
extend without touching routing.
