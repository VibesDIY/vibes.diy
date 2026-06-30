# Catching publish-only regressions before release prep

Source: `claude/merge-2864-4x9ffe` — bringing #2864 ("CI guard: run api-svc
publish build on PRs", fixes #2862) onto current `main`.

Most CI catches what `pnpm build`/`test` catch. But a package's *publish* build
path — the dist-only tsconfig, the export map, the lockfile inputs — can break
in ways the dev build never exercises, and you only find out during release
prep. This change adds a dedicated `publish_build_api_svc` job that runs
`pnpm --filter @vibes.diy/api-svc run pack` on PRs, gated by a new
`api_svc_publish_needed` output from the `changed-scope` action.

Worth a note:

- **A "publish build" guard must not actually publish.** The first cut ran the
  `publish` script — but that script is `core-cli build`, the same command the
  credentialed release workflow runs to push to npm. In PR CI there is no
  `NPM_TOKEN`, so it would have reddened every api-svc PR after a clean build.
  The fix is the `pack` script (`core-cli build --doPack`): identical build
  path, packs a tarball instead of publishing. The lesson: when you want to
  *exercise* a publish path in CI, reach for the dry-run/pack variant, never the
  real publish — the goal is coverage, not a release.

- **Fail open on diff uncertainty.** The scope detector emits
  `api_svc_publish_needed=true` whenever the base fetch fails, the diff errors,
  or the diff comes back empty — the same fail-open discipline `docs_only`
  already uses. Publish coverage is never skipped because git was unsure; it's
  only skipped when the diff *positively* shows none of the publish inputs
  (`vibes.diy/api/*`, `call-ai/*`, `pnpm-lock.yaml`, `tsconfig.dist.json`, …)
  were touched.
- **Make the gate assert the skip, not just the success.** The job runs as its
  own node so `compile_test` can treat `skipped` as a *failure* when
  `api_svc_publish_needed=true` — a skipped-but-needed publish build is a red
  check, not a silent pass. A separate required job is what lets the aggregate
  gate distinguish "correctly not needed" from "should have run."
- **Merge conflicts are where two true things meet.** Landing this on current
  `main` collided with the `landing-pages/` addition to the docs allowlist —
  both edits touched the same `DOCS_RE` region. The resolution keeps both: the
  expanded lean-eligible allowlist *and* the new publish-input regex. Neither
  side was wrong; the conflict just marked where they overlapped.
