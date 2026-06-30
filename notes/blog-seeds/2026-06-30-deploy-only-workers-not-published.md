# The package that didn't belong in the guard

Source: `claude/merge-2864-4x9ffe` — what started as "add `@vibes.diy/api-logpush-etl`
to the publish-build guard" (#2888) turned into "stop pretending two deploy-only
workers are published packages." The thread that got us there began as watchout
#1 in #2889.

The publish-build guard runs `pnpm -r run --if-present pack` over the workspace.
An audit found one publishable package the guard skipped — `api-logpush-etl`, a
Cloudflare Worker with no `pack` script — so the obvious fix was to add one and
bring it under the guard, matching its sibling worker `api-queue`.

Then review pulled the thread. Adding the matching `publish` script would have
enrolled the worker in the *real* npm fan-out (`actions/core-publish` runs
`pnpm run -r publish` on `pkg@*` tags), and its `main: ./worker.ts` isn't in the
packed payload — so it'd publish a non-resolving package. Chasing *why* api-queue
got away with the same `main` mismatch was the tell: **nobody consumes these
workers.** Zero workspace dependents, zero imports. They're deployed via
`wrangler`, not installed from npm. api-queue was being published to the public
registry on every release tag for no reason at all — pure boilerplate drift,
invisible because the broken entry it shipped was never resolved by anyone.

So the real fix inverted the original one: mark both workers `private: true` and
strip their `pack`/`publish`. The guard is for published libraries; a worker
isn't one.

Worth a note:

- **"Make X match its sibling" is only right if the sibling is right.** The
  sibling (`api-queue`) wasn't a convention to copy — it was the same bug, one
  step further along (already publishing a broken artifact). The fix was to pull
  *both* out, not push a third in.
- **`private` should be the single honest signal.** Once the deploy-only workers
  are `private`, the invariant the #2889 assertion wants becomes clean: every
  *non*-private package is a real published lib with a real `pack`; everything
  else (workers, tests, evals) is private and the guard skips it via
  `--if-present`. This PR finishes that sweep: the six remaining non-private
  `echo`-stub packages — the app (`@vibes-diy/pkg`), `stable-entry`, `stories`,
  and the three test harnesses — get `private: true` too. None has a single
  workspace consumer and none was ever really published (their publish was an
  `echo`), so the change is inert at runtime but makes the invariant exact:
  **every non-private package now has a real `pack`, and nothing else does.**
  The #2889 assertion can finally be allowlist-free.
- **Coverage questions and scope questions are the same question.** "Is this
  package covered by the guard?" and "should this package exist in the guard's
  world at all?" looked like two problems; they had one answer. The audit that
  asked "what did `--if-present` silently skip?" surfaced both.
