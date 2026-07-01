# `always()` turns a cancelled CI run into a fake red X — and the "skipped is unsafe" trap

Source: `claude/issue-2992-cirun`

Our CI cancels superseded runs (`concurrency: cancel-in-progress`) — only the
latest commit's result matters. But the required aggregation gate, `compile_test`,
ran with `if: always()` so it could report red when a real upstream failed. The
catch: `always()` is true *even during cancellation*. So a superseded run's every
upstream concluded `cancelled`, the gate still ran, saw the all-`cancelled`
fingerprint, and `exit 1` — a bogus red ✗ and a `failure` webhook on a run that
tested nothing. Common (two events per push, quick re-pushes) and easy to mistake
for a broken build.

The one-token fix: `always()` → `!cancelled()`, so a run-level cancellation
reaches the gate too and it's `skipped` alongside its upstreams instead of
failing. Real upstream `failure` still runs the gate (a `failure` isn't a
`cancellation`) and still goes red.

The story worth writing up is the review loop. Two bot reviewers (Charlie + Codex)
blocked it with the same sharp objection: GitHub counts a `skipped` **required**
check as *passing*, so on a same-SHA supersede that `skipped` could green an
unverified head. Technically correct — and it looked authoritative coming from two
independent reviewers. The reflex is to yield. But the objection assumes a config
we don't have: `main` has no required status checks, and the only automated
consumer of the gate's conclusion (the deploy-time `check-sha-tested` lookup)
matches strictly on `conclusion=="success"`, so a `skipped`/`cancelled` gate
always forces a full re-test rather than counting as passing. Grounded in the
repo's actual behavior, the change is safe; the reviewers were right in the
abstract and wrong for this codebase.

Two durable lessons. (1) Check-run conclusions aren't binary — `success` /
`failure` / `cancelled` / `skipped` / `neutral` are distinct, and required-check
"passing" is `{success, skipped, neutral}` while `{failure, cancelled,
timed_out}` block; a superseded run should land on a neutral one. (2) A confident
bot review that says "this weakens a safety gate" deserves verification against
the repo's real config, not reflexive compliance — and when a bot's advice
amounts to "don't do this change at all," that's a call to escalate to a human,
not to quietly abandon the work.
