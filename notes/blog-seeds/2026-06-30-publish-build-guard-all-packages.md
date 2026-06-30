# When generalizing a guard makes it smaller

Source: `claude/merge-2864-4x9ffe` — broadening the api-svc publish-build CI
guard (#2879) to every published package, the "then broaden to all" half of
#2862.

The first cut of this guard (#2864/#2879) was deliberately api-svc-shaped: a
hand-maintained regex (`API_SVC_PUBLISH_RE`) listing api-svc's publish inputs,
an `api_svc_publish_needed` scope output, and a single job filtered to that one
package. Generalizing to *all* published packages didn't make it bigger — it
made it smaller. The whole per-package machinery dissolved.

Worth a note:

- **A change-detection regex was approximating something the package manager
  already knows.** The point of the regex was "did anything api-svc's publish
  build depends on change?" But once the guard builds *every* published package,
  the question collapses to "did any non-docs file change?" — which `changed-scope`
  already answers as `docs_only`. So the new gate reuses `docs_only` (exactly
  like the test matrix) and the regex + the extra scope output were deleted.
  Generalizing removed a thing to maintain instead of adding twenty.
- **`pnpm -r run --if-present pack` is the whole guard.** One command builds
  every package's isolated publish build in topological order: the real ones
  (`core-cli build --doPack`) compile and pack a tarball, the `echo`-stub and
  test packages no-op, and packages with no `pack` script (eval/*, examples)
  are skipped. No package list to keep in sync — the workspace *is* the list.
  "Shared-dependency change re-checks dependents" falls out for free because
  everything is built.
- **It's free wall-clock.** `compile_test` already blocks on the ~4-min Docker
  test matrix; the publish-build job runs concurrently on a free standard runner
  (public repo) and finished ~20 real package builds in ~70s locally. A guard
  that costs nothing on the critical path is a guard people leave on.
- **Validate the gate by running the thing it gates.** Before pushing a CI
  change that compiles 20 packages, I ran `pnpm -r run --if-present pack` locally
  — all green, so the new required check won't be blocked by a *pre-existing*
  latent publish break the moment it lands. If it had been red, that red would
  have been the guard doing its job on day one.
