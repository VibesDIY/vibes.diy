# Flaky tests

Track: [VibesDIY/vibes.diy#1515](https://github.com/VibesDIY/vibes.diy/issues/1515)

`pnpm check` occasionally fails on tests that pass on rerun (or in isolation), with no code change between runs. Seen across multiple runners:

- **chromium browser tests**: `Invalid hook call` / `Cannot read properties of null (reading 'useState')` — multiple React copies surfacing under the parallel chromium runner.
- **api-tests**: SQLite contention or state bleed between parallel suites (e.g. `owner cannot request access to own app`, `Result is Err`) — passes when run alone.

Not a regression in the changes under test.

## When you hit a flaky failure

1. **Rerun `pnpm check`** (or the specific suite in isolation, e.g. `cd vibes.diy/tests && pnpm test <pattern>`) before assuming it's a real failure. If it passes the second time with no code change, it's flaky.
2. **Add a comment to #1515** with the file/test names and the date. Do not edit existing comments — append.
3. **Proceed with the commit**. Do not block on flaky failures alone, and do not "fix" them by deleting the tests or marking them skipped.

## When NOT to call something flaky

- A test that fails consistently across reruns. That's a real failure — investigate.
- A test whose failure mode matches your code change (e.g., you touched the resolver and resolver tests fail). Even if it's "usually" flaky, the change might be real.

The issue exists so we can ignore known flakes during day-to-day work _and_ periodically batch-fix them with full context.

## CI test gating switch (#2426)

The `test` step in [`actions/base/action.yaml`](actions/base/action.yaml) used to end in `|| true` with a 120s `timeout`, so the ~240s suite was SIGKILLed mid-run and any failure was silently swallowed — `compile_test` was a "does the container start" check, not a test gate ([#2426](https://github.com/VibesDIY/vibes.diy/issues/2426)).

It now:

- runs the suite to completion (timeout raised to 30m),
- captures the real exit code (no `|| true`), and
- **surfaces** the result into the GitHub job summary plus a `::warning::` annotation on every run.

Gating is controlled by one env var, `VIBES_CI_GATE_TESTS`, in that step:

- `"false"` (current) — real **test** failures (vitest exit `1` with a parsed summary) are surfaced loudly but do **not** fail the job. Keeps PRs unblocked while the deterministic failures in [#2425](https://github.com/VibesDIY/vibes.diy/issues/2425) are outstanding.
- `"true"` — test failures fail the job. **Flip to this once #2425 is closed** — that is the final close-out of #2426.

The switch only governs _test_ failures. **Harness/setup failures always fail the job** regardless of the switch — a non-`1` exit (docker `125`/`126`/`127`, `timeout` `124`) or any exit with no test summary means the suite never ran, so it is never suppressed. The summary is parsed from an ANSI-stripped copy of the output (vitest colorizes the `Test Files` / `Tests` lines), so a real test failure is never misread as a harness failure.

Two image gotchas the masking hid for ages: the Playwright image tag is derived from `pnpm exec playwright --version` (not `pnpm why`, whose JSON shape changed under pnpm 10 and silently produced an invalid `:v-noble` tag), and `pnpm` is activated **inside** the container via `corepack` (the image ships only node/npm, but the vitest globalSetup runs `pnpm exec drizzle-kit`). Both fail fast on an unresolved version before `docker run`.
