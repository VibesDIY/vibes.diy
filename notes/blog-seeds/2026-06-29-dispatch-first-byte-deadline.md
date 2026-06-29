# Don't let a silent OpenRouter stall become a 5-minute zombie generation

Source: #2838 (slow first-token silently orphans a generation turn), branch `claude/run-guide-twenty-stuck-jk52ke`.
Started as a "did my vibe get stuck?" question about `jchrisa/run-guide-twenty` and turned into a
root-cause + fix.

Goal: a code-gen turn whose model never returns a first byte should fail fast with a typed
`prompt.error` (which the client already renders with a retry button), not hang until the creator
gives up.

What actually happened (forensics worth a full post):

- **The fingerprint, read from two planes.** Control-plane (Neon): the turn had a `prompt.req`
  block but no `prompt.raw`, no `PromptContexts` row, no `Apps` filesystem — dispatched but never
  produced a first token. Worker logs (R2 logpush): a single SSE invocation ran **~5 min at ~0% CPU
  (208ms/295s), zero log lines, zero exceptions, `outcome=canceled`** — a classic `await` parked on
  a socket that opened but never replied, ended only when the browser gave up. Ship-restart was
  ruled out by deploy timestamps (deploy finished 37 min earlier; two turns succeeded in between).

- **The unguarded window.** `prompt-chat-section.ts` writes `prompt.req`, then
  `await dispatchLlmRequestWithFallback(...)` to get a streamable `Response`, and only *after* that
  starts the `withHeartbeat`-wrapped read loop. The heartbeat protects gaps *between* tokens — the
  connect/first-byte window emits nothing. Meanwhile the client transport's 30s idle timeout fires
  and the browser reconnects into the *same* hang (we saw the reconnect storm in logpush). The
  server had **no cutoff of its own**, which is why it sat for 5 minutes.

- **The fix is a per-attempt first-byte deadline, not a wrapper around the whole dispatch.** The
  deadline lives in `attemptLlmRequest`, wired to the AbortController it already creates. On expiry
  we abort and classify the failure as a new `kind: "timeout"` that is **retryable** — so the
  existing primary-retry → catalog-fallback machinery still runs instead of dying on attempt one.
  A separate total budget (`DISPATCH_TOTAL_BUDGET_MS`) caps the stacked worst case and each
  attempt's timeout is `min(per-attempt, budget-remaining)`.

- **No new error-surfacing code needed.** The handler's `scope.onCatch` *already* writes
  `prompt.error` + a `build-failed` notification on any throw. The incident produced none only
  because the dispatch hung instead of failing. Converting the hang into a failure routes it
  through the path that was always there — the cleanest kind of fix.

- **Diagnosability was half the bug.** The DO emitted *nothing* for a 5-min hang. Added
  `llm-dispatch-start` / `llm-dispatch-settled` breadcrumbs around the await so the next stall is
  one grep, not an R2 archaeology dig.

- **Trade-off / tuning.** 45s per-attempt, 120s total. Healthy first-token latency is single-digit
  seconds, so 45s is wide margin against false positives while still ≪ the 5-min zombie. Both are
  env-overridable (`DISPATCH_FIRST_TOKEN_TIMEOUT_MS`, `DISPATCH_TOTAL_BUDGET_MS`) — tunable in prod
  without a redeploy, and the regression test injects 50ms/5s to run in ~0.5s instead of 45s.

- **Still open (follow-up):** the read loop's *first delta* after stream-open is heartbeat-kept-
  alive but not deadline-bounded. The observed incident hung at connect, so this fix covers it, but
  a stream that opens then never emits a token is a sibling failure mode worth a second guard.
