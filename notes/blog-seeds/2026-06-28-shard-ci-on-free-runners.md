# Sharding CI across free runners instead of buying a bigger one

Source: `claude/github-larger-runners-i32q7j` — restructure `ci.yaml` + add shard
inputs to `actions/base`

The ask started as "give CI a bigger/faster machine" via a GitHub-hosted larger
runner. Pulling the Actions log first changed the answer: the slowest thing by far
is the single `compile_test` job (~6 min), ~100% of which is the `./actions/base`
composite, dominated by the ~4-min Docker Playwright/vitest suite. Everything else
(pg-concurrency ~2 min, pr-preview ~90s) is already cheap.

The twist that killed the larger-runner plan: **`vibes.diy` is a public repo.**
Standard runners are free, unlimited, and concurrent on public repos — so CI costs
$0 today. Larger runners are *not* free even on public repos (billed per-minute)
and require upgrading the org to a paid Team plan. So the "bigger machine" route
flips CI from $0 → paying on two axes, while the free path was sitting right there:
fan the suite out across several free standard runners.

Worth a note:

- **A runner group is a permission list, not an auto-assignment.** A workflow only
  lands on a given runner if its `runs-on` names it. So "All workflows" on the
  org's new runner group is safe — nothing migrates onto it implicitly; only the
  job you point there uses it. That removed the urge to fiddle with the
  per-workflow allow-list (whose `@ref` footgun would have queued PR runs forever,
  since `pull_request` reads the workflow from the base branch).
- **`vitest --shard` is free real estate here.** Root `test` is one
  `vitest --run` over a 17-project workspace (353 files); `--shard=i/N` splits the
  sorted file list with no per-project wiring. The only duplicated cost is the
  `api/tests` libsql `globalSetup` (a ~few-second `drizzle-kit push`) re-running
  per shard — trivial against a 4-min suite. The heavy Postgres setup lives in the
  separate pg-concurrency lane and is untouched.
- **`build` is a typecheck, not a test prerequisite.** `pnpm run build` is
  `core-cli tsc`. The pg-concurrency lane and `test:all` both run the suite with no
  build step, proving vitest resolves workspace deps to source — so the shards can
  skip format/lint/build entirely (`run-checks: 'false'`) and those run once in a
  dedicated `checks` job instead of redundantly ×N.
- **Keep the required-check name on a gate job.** Splitting `compile_test` into
  `checks` + a `test` matrix would have renamed the required branch-protection
  check (and broken the deploy-time "is this SHA `compile_test`-green?" lookup in
  `actions/base`). The fix: a tiny final job *named* `compile_test` that `needs`
  the others and fails if any concluded non-`success`/non-`skipped` —
  `always()`-guarded so it can still report red, and it treats a `skipped`
  upstream (docs-only test job, or a `[skip ci]` cascade) as a pass. No admin
  change needed.
- **Backward-compatible composite.** The four deploy workflows reuse
  `actions/base`; the new `run-checks` / `run-tests` / `shard` / `artifact-suffix`
  inputs all default to today's behavior, so deploys are byte-for-byte unchanged.
