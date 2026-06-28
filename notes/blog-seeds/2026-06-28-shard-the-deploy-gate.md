# Sharding the deploy's test gate (and the check it has to keep emitting)

Source: `claude/shard-vibes-diy-deploy` — fan the deploy's pre-deploy suite out
across free runners, after #2782 did the same for PR CI

#2782 sharded PR CI but deliberately left the deploy workflows alone. Then a
`vibes-diy@c` deploy off a non-PR-tested SHA ran the full ~4-min suite serially
inside `actions/base` before the deploy step — visibly slow. The deploy action
(`vibes.diy/actions/deploy`) does its **own** `pnpm run build` + `wrangler
deploy`, so everything `actions/base` runs in a deploy is purely a *pre-deploy
gate* — and that gate is the exact suite #2782 already learned to shard.

Restructured `vibes-diy@*` from one job into `gate → (checks ‖ test×4) →
compile_test → deploy`.

Worth a note:

- **The deploy job barely needs `actions/base`.** Since the deploy action builds
  itself, the deploy job only needs `pnpm install` — `run-checks:'false'
  run-tests:'false'` reduces `actions/base` to runtime + install. lint/build/test
  move to dedicated parallel jobs that *gate* the deploy.
- **Keep the job name or you silently break test reuse.** The old single job was
  named `compile_test`, so it emitted a `compile_test` check on every deploy SHA
  — and `skip-tests-if-sha-green` keys on exactly that name. Naively renaming the
  jobs (`gate`/`checks`/`test`/`deploy`) would stop emitting it, so a second
  same-SHA deploy (`@p` after `@c`) would re-run the whole suite instead of
  reusing. Fix: a `compile_test` **aggregator** job that keeps the name and
  re-emits the reusable green check. The job name is a load-bearing API here, not
  cosmetics.
- **Hoist the skip decision to job level.** `skip-tests-if-sha-green` lived
  *inside* `actions/base` as a step guard — fine for one job, useless for a
  matrix. Lifting the green-SHA lookup into a `gate` job lets a green SHA skip the
  *whole* matrix + checks, not just one step, and the gate fails safe to
  "not green" on any API hiccup so coverage is never silently dropped.
- **A deploy workflow gets no PR CI.** It triggers on tag/path pushes, not
  `pull_request`, so the PR can't exercise it — the first real run is an actual
  deploy. Test it with a low-blast-radius `vibes-diy@d*` (dev) tag before any
  cli/prod tag.
- **Gate the deploy on the aggregator, not a sprawling `if`.** `deploy: needs:
  compile_test` with the default `success()` gate means a red suite, red
  lint/build, or `[skip ci]` (which skips the aggregator) all block the deploy
  with no bespoke conditional — the aggregator is the single chokepoint.
