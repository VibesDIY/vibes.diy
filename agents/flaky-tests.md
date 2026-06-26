# Flaky tests

Track: [VibesDIY/vibes.diy#1515](https://github.com/VibesDIY/vibes.diy/issues/1515)

A flake is a test that fails on `pnpm check` but passes on rerun (or in isolation) with **no code change** between runs — not a regression in the change under test. Flakes have surfaced on both the chromium browser runner and the parallel api-tests (state bleed / timeouts under load).

#1515 is the running log. It is intentionally kept generic — check the issue's comments for current known flakes rather than maintaining a list here. A test that fails the same way on every run is **not** a flake; that's a real failure and gets its own issue.

## Optional LoopX triage packet

When a maintainer wants help before rerunning CI or appending to #1515, they can
ask their local agent to follow [`loopx-flaky-watch.md`](loopx-flaky-watch.md).
That flow is read-only by default: it prepares a no-send triage packet from the
failed run, changed files, same-head rerun evidence, and any isolated test result
the maintainer provides.

LoopX must not comment on #1515, rerun CI, open issues, open branches, or mark a
failure as ignorable without explicit maintainer approval. Its job is to keep
the repeated flake-watch context together so the human decision is faster and
less repetitive.

## When you hit a flaky failure

1. **Rerun `pnpm check`** (or the specific suite in isolation, e.g. `cd vibes.diy/tests && pnpm test <pattern>`) before assuming it's a real failure. If it passes the second time with no code change, it's flaky.
2. **Add a comment to #1515** with the file/test names, the symptom, and the date. Do not edit existing comments — append.
3. **Proceed with the commit**. Do not block on flaky failures alone, and do not "fix" them by deleting the tests or marking them skipped.

## When NOT to call something flaky

- A test that fails consistently across reruns. That's a real failure — investigate and file its own issue.
- A test whose failure mode matches your code change (e.g., you touched the resolver and resolver tests fail). Even if it's "usually" flaky, the change might be real.

The issue exists so we can ignore known flakes during day-to-day work _and_ periodically batch-fix them with full context.

## CI test gating switch (#2426)

The `test` step in [`actions/base/action.yaml`](actions/base/action.yaml) used to end in `|| true` with a 120s `timeout`, so the ~240s suite was SIGKILLed mid-run and any failure was silently swallowed — `compile_test` was a "does the container start" check, not a test gate ([#2426](https://github.com/VibesDIY/vibes.diy/issues/2426)).

It now:

- runs the suite to completion (timeout raised to 30m),
- captures the real exit code (no `|| true`), and
- **surfaces** the result into the GitHub job summary plus a `::warning::` annotation on every run.

vitest runs with **only** the json reporter (`--reporter=json --outputFile=test-timing.json`) — the pretty reporter is gone; raw stdout still streams to the Actions log for live debugging. [`parse-test-timing.py`](actions/base/parse-test-timing.py) turns that report into the job summary (totals, **Top-20 slowest files**, and any failures), and the raw `test-timing.json` is uploaded as the `test-timing` artifact (30-day retention) for offline / cross-run timing analysis.

Gating is controlled by one env var, `VIBES_CI_GATE_TESTS`, in that step:

- `"true"` (**current**) — real **test** failures (vitest exit `1` with a parsed summary) fail the job, so a red suite blocks the PR. Enabled once the deterministic failures ([#2425](https://github.com/VibesDIY/vibes.diy/issues/2425)) were fixed and `pnpm test` exits 0 ([#2444](https://github.com/VibesDIY/vibes.diy/issues/2444)) — the close-out of #2426. There is **no** retry-on-flake wrapper: if a known flake (see #1515) reds CI, rerun the job to clear it.
- `"false"` — failures are surfaced (job summary + `::warning::`) but do **not** fail the job. Use only as a temporary escape hatch if flakes become disruptive.

The switch only governs _test_ failures. **Harness/setup failures always fail the job** regardless of the switch — a non-`1` exit (docker `125`/`126`/`127`, `timeout` `124`) or any exit with no valid `test-timing.json` report means the suite never ran, so it is never suppressed. "Did the suite actually report" is now decided by the presence of a parseable json report (the `HAVE_JSON` check), not by scraping the human output, so a real test failure is never misread as a harness failure.

Two image gotchas the masking hid for ages: the Playwright image tag is derived from `pnpm exec playwright --version` (not `pnpm why`, whose JSON shape changed under pnpm 10 and silently produced an invalid `:v-noble` tag), and `pnpm` is activated **inside** the container via `corepack` (the image ships only node/npm, but the vitest globalSetup runs `pnpm exec drizzle-kit`). Both fail fast on an unresolved version before `docker run`.

## Pre-run instrumentation

To find "dumb work" before tests actually execute, `actions/base` also captures:

- **Per-file pre-run phases.** A second reporter, [`tools/vitest-phase-reporter.ts`](tools/vitest-phase-reporter.ts), writes `test-phase-timing.json` with per-file `collect`/`setup`/`environment`/`prepare`/`test` durations (the json reporter only exposes start/end, hiding the dominant import phase). `parse-test-timing.py` adds a "Pre-run phase costs" table + Top-15 files by pre-run time to the job summary; the file rides along in the `test-timing` artifact. The reporter never throws out of a hook (a thrown reporter aborts the run) and supports both the legacy `onFinished` and v4 `onTestRunEnd` APIs.
- **Per-step CI timings.** Each pre-test step (`runtime-setup`, `install`, `format-check`, `lint`, `build`) appends `<label>\t<seconds>` to `$RUNNER_TEMP/pretest-timings.tsv`; the final `pre-test-step-timings` step renders a table into the job summary — so wasted time in install/lint/build is visible without scraping the collapsed composite-step logs.
- **globalSetup cost.** [`globalSetup.libsql.ts`](vibes.diy/api/tests/globalSetup.libsql.ts) logs the `drizzle-kit push` and total time (the one-time, once-per-project DB schema setup) to stdout.
