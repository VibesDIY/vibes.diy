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
