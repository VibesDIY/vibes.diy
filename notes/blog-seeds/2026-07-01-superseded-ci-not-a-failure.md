# `always()` turns a cancelled CI run into a fake red X

Source: `claude/issue-2992-cirun`

Our CI cancels superseded runs (`concurrency: cancel-in-progress`) — a good
speed/cost win, only the latest commit's result matters. But the required
aggregation gate, `compile_test`, ran with `if: always()` so it could report red
when a real upstream job failed. The catch: `always()` is true *even during
cancellation*. So when a push superseded an in-flight run, every upstream
concluded `cancelled`, the gate still ran, saw the all-`cancelled` fingerprint,
and `exit 1` — a bogus red ✗ and a `failure` webhook on a run that tested
nothing. Common (two events per push, quick re-pushes) and easy to mistake for a
broken build.

The one-token fix: `always()` → `!cancelled()`. The GitHub status-check
functions aren't interchangeable — `always()` ignores cancellation, but
`!cancelled()` lets a run-level cancellation reach the gate too, so it's
`skipped` alongside its upstreams instead of failing. Crucially it still runs on a
real upstream `failure`, because a `failure` is not a `cancellation` — so red
builds still go red. The subtlety worth writing up: check-run conclusions are not
binary (`success`/`failure`/`cancelled`/`skipped`/`neutral`), and a superseded
run should land on one of the neutral ones — the superseding run provides the
real `success`. Branch protection still won't merge on a `skipped` gate, which is
correct: a superseded run verified nothing.

Bonus gotcha for agent workflows: cloud sessions can't re-run workflows via the
GitHub MCP (`rerun_workflow_run` → 403 "Resource not accessible by
integration"), so before this fix the only recourse to clear a phantom-red
superseded run was an empty commit. Making superseded runs self-identify as
neutral removes that busywork. Documented the interpretation in
`agents/flaky-tests.md` § "`cancelled` ≠ `failure`".
