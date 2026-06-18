# Flaky tests

Track: [VibesDIY/vibes.diy#1515](https://github.com/VibesDIY/vibes.diy/issues/1515)

A flake is a test that fails on `pnpm check` but passes on rerun (or in isolation) with **no code change** between runs — not a regression in the change under test. Flakes have surfaced on both the chromium browser runner and the parallel api-tests (state bleed / timeouts under load).

#1515 is the running log. It is intentionally kept generic — check the issue's comments for current known flakes rather than maintaining a list here. A test that fails the same way on every run is **not** a flake; that's a real failure and gets its own issue.

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

Gating is controlled by one env var, `VIBES_CI_GATE_TESTS`, in that step:

- `"true"` (**current**) — real **test** failures (vitest exit `1` with a parsed summary) fail the job, so a red suite blocks the PR. Enabled once the deterministic failures ([#2425](https://github.com/VibesDIY/vibes.diy/issues/2425)) were fixed and `pnpm test` exits 0 ([#2444](https://github.com/VibesDIY/vibes.diy/issues/2444)) — the close-out of #2426. There is **no** retry-on-flake wrapper: if a known flake (see #1515) reds CI, rerun the job to clear it.
- `"false"` — failures are surfaced (job summary + `::warning::`) but do **not** fail the job. Use only as a temporary escape hatch if flakes become disruptive.

The switch only governs _test_ failures. **Harness/setup failures always fail the job** regardless of the switch — a non-`1` exit (docker `125`/`126`/`127`, `timeout` `124`) or any exit with no test summary means the suite never ran, so it is never suppressed. The summary is parsed from an ANSI-stripped copy of the output (vitest colorizes the `Test Files` / `Tests` lines), so a real test failure is never misread as a harness failure.

Two image gotchas the masking hid for ages: the Playwright image tag is derived from `pnpm exec playwright --version` (not `pnpm why`, whose JSON shape changed under pnpm 10 and silently produced an invalid `:v-noble` tag), and `pnpm` is activated **inside** the container via `corepack` (the image ships only node/npm, but the vitest globalSetup runs `pnpm exec drizzle-kit`). Both fail fast on an unresolved version before `docker run`.
