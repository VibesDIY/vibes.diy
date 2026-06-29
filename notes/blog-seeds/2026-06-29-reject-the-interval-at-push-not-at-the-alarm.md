# Reject the bad cron interval at push time, not when the alarm fires

Source: `claude/backend-js-b2-discovery` (B2a of #2856; follows the B1 executor seam)

The second slice of per-app `backend.js` is the boring-but-load-bearing one: when an author pushes a
vibe, the platform reads `backend.js` and decides what to register. The interesting decision was *where*
to draw the validation line. A `config.scheduled.interval` of `"1s"` is a foot-gun — it'd melt the
render fleet — so the design caps intervals at `[5s, 1h]`. The tempting place to enforce that is at
runtime (clamp it when the Durable Object arms its alarm), but the right place is **push time**: parse
the source, and if the interval is sub-5s, over-1h, or malformed, *reject the push with a clear error*
rather than silently clamping or letting a runaway schedule get stored. Three things worth a post: (1)
the "fail at authoring time, not at execution time" principle — a clamped interval is a surprise the
author never sees, a rejected push is feedback they can act on; (2) the discipline of slicing a schema
migration *out* of a parser PR — B2 split into B2a (a pure, 100%-CI-testable `parseBackendConfig` with
no DB) and B2b (the table + migration + push wiring, landed with the consumer that reads it), so a risky
migration never rides along with logic that doesn't need it; and (3) the small regex traps in
statically reading author JS — word-boundarying export detection so `prefetch` isn't mistaken for the
`fetch` handler, and scoping the `interval:` match to inside the `scheduled:` block so a stray
`ui: { interval: "1s" }` elsewhere in the config doesn't hijack the schedule. Static-parsing untrusted
source is lossy by nature; the art is being conservative about what you *accept*, not clever about what
you infer.
