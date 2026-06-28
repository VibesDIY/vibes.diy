# The failed-test names were everywhere except the one place triage looks

Source: #2752

`compile_test` writes a beautiful failure breakdown — per-test FAIL lines, suite
import errors, unhandled rejections — into `$GITHUB_STEP_SUMMARY` and the uploaded
`test-timing.json` artifact. What it did *not* do was put any of that in the raw
job log. The only thing `parse-test-timing.py` printed to stderr was the aggregate
`parse-test-timing: 342 files, 2874 tests, 4 failed`. So anyone diagnosing a red PR
through the Actions logs API (`get_job_logs`) — or an agent that only has log
access — could see *that* four tests failed but had to download and JSON-parse an
artifact to learn *which*. The fast path degraded to "just re-run and hope," which
is exactly the flaky-vs-real decision the flaky-tests gating (#2425/#2426) is
supposed to make cheap.

The fix was one additive block: before printing the aggregate line, also echo each
failing identity to stderr — `FAILED: <file> > <test>` per assertion, `FAILED
(suite): <file> — <first line of error>` for import/setup failures, `UNHANDLED:
...` for the rejections that fail a run with zero failed tests. The summary and
artifact output are untouched; the names just *also* land in the log stream now.

The seedworthy part: **rich diagnostics in a channel the consumer can't read is
the same as no diagnostics.** The step summary is for a human clicking through the
GitHub UI; the artifact is for offline analysis. Neither serves the increasingly
common reader — an API client or automation triaging from logs alone. When you add
observability, ask *who reads it and through which pipe*, then make sure the
high-signal bit (here: the failing test names, not the count) reaches that pipe.
The cheapest place to surface a fact is the stream people are already tailing.
