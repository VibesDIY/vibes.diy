# A per-vibe cron that can't drift, hammer, or forget who it is

Source: `claude/backend-js-b4-alarms` (B4 of #2856; follows B3's `_api` → BackendDO request path)

B4 gives each vibe's `backend.js` a `scheduled` handler on a Cloudflare Durable Object alarm. "Run a
function every 15 minutes" sounds trivial; doing it correctly surfaced four edge cases, each a small
design decision that the obvious implementation gets wrong:

1. **Which release's schedule?** A vibe can have a published production release *and* a newer dev push.
   The page serves production; the alarm must too, or a dev push could silently change the production
   cron. So the DO doesn't *trust* a "here's your interval" message — a push just *pokes* it to
   **re-evaluate**, and the DO recomputes the cadence from the same selected-release resolver the page
   uses. The poke is payload-agnostic: a stale interval physically can't reach the alarm.

2. **Who am I, after eviction?** The DO is addressed by `idFromName(hash(owner, slug))` — a one-way
   hash. `fetch` learns its vibe from request headers, but `alarm()` has *no incoming request*. If the
   DO is evicted between arming and the tick (the normal case), it would wake up with no idea which vibe
   to run. Codex caught this on the spec. Fix: persist `{owner, slug}` in DO storage at arm time; the
   tick reads its identity from there, and self-clears if it's somehow missing rather than throwing.

3. **No overlapping ticks, but don't block `fetch`.** Single-flight for the timer lane comes from
   re-arming at the *end* of each tick (so a tick that overruns its interval can't stack) plus an
   in-memory guard — while `fetch`/`onChange` run unblocked, because they're not on the timer lane.

4. **A broken handler shouldn't hammer — or disappear.** On failure, exponential backoff
   (`min(interval, cap, base·2^n)`); but after a few consecutive failures it **caps and resumes the
   configured interval** rather than backing off forever or disarming. A permanently-broken cron
   degrades to "fail once per interval, wait" — the configured cadence stays the source of truth, and no
   manual recovery is needed when a transient incident clears.

Two structural notes worth a paragraph: the heavy logic (resolve, invoke, the arm/backoff *math*) lives
in pure, unit-tested `api-svc` functions, so the DO is a thin shell validated by the build — ~40 fast
tests, no Durable-Object harness. And the push-time poke rides the existing `VIBES_SERVICE` queue,
whose worker already retries on a handler `Err` — so "make the poke durable" was just *returning the
error* instead of the swallow-and-log pattern the neighbouring handlers use. The retry was free; using
it correctly was a one-line decision.
