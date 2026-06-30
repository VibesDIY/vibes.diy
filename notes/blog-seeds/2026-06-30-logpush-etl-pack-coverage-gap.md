# The package the guard quietly skipped

Source: `claude/merge-2864-4x9ffe` — adding `pack`/`publish` scripts to
`@vibes.diy/api-logpush-etl` so the all-packages publish-build guard (#2888)
actually covers it. The concrete instance of watchout #1 in #2889.

The guard runs `pnpm -r run --if-present pack`. That `--if-present` is load-
bearing — it lets eval/* and examples (no `pack` script) ride along without
erroring. But it's also a silent failure mode: a *publishable* package with no
`pack` script isn't an error, it's just invisible. The guard reports green while
never building it.

`@vibes.diy/api-logpush-etl` was exactly that: the lone outlier among eight
`vibes.diy/api/*` packages (the other seven all carry `pack`), a Cloudflare
Worker added recently that never picked up the sibling convention. Its sibling
worker `api-queue` has the standard `pack`, so "it's a worker" wasn't the reason
— it just slipped through, and `--if-present` ensured nobody would notice.

Worth a note:

- **`--if-present` trades a loud failure for a silent one.** It's the right call
  for a guard that fans out over a whole workspace (you can't require every
  package to define every script), but it means "covered" and "has no script to
  run" look identical in the logs. The real fix is the assertion proposed in
  #2889: every non-private package must have a real (non-`echo`) `pack` or be on
  an explicit stub allowlist — so dropping or omitting one fails CI instead of
  quietly narrowing coverage.
- **Find the gap by asking the inverse question.** The guard's green check
  answers "did everything that ran, pass?" The coverage question is "did
  everything that *should* run, run?" — and you only get that by enumerating the
  workspace and diffing against what `--if-present` actually executed. One
  package fell out. Verified its isolated compile is green (`core-cli build
  --doPack` → tarball), so adding the script brings it under the guard with zero
  breakage.
