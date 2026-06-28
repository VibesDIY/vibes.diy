# A check name as a load-bearing API — and the optimization it was blocking

Source: `claude/dedup-compile-test-check-name` — closes #2790, follow-up to the
deploy-gate sharding (#2788)

The deploy/CI "is this SHA already tested?" fast path keys on a GitHub check-run
literally **named** `compile_test`. Two publish workflows (`prompts-publish`,
`use-vibes-publish`) had a job named `compile_test` that **skips the test suite**
(`pnpm run lint || true`, no tests) — so they emitted a green `compile_test` that
didn't mean what every consumer assumed. On a cross-stream same-SHA tag, that
false green could let a `vibes-diy` deploy skip its real gate.

#2788 mitigated this defensively (the deploy's lint/build `checks` job ran
*always*, even on a green SHA, so a misleading green could only skip the
re-runnable tests, never the backstop). This PR fixes it at the source and
removes the now-unnecessary backstop.

Worth a note:

- **The check name is the API; treat a rename as a contract change.** Renaming
  the two test-skipping jobs `compile_test` → `publish` is the whole fix: now
  *only* workflows that actually run the suite (`ci.yaml`, the deploy aggregator,
  `call-ai-publish` — which runs full `actions/base`) emit `compile_test`. A
  green one again means "lint+build+test passed," everywhere.
- **A safety backstop is debt once the invariant holds.** With the name
  unambiguous, the deploy's "run lint/build even on a green SHA" guard became
  pure waste. Removing it lets a genuinely-green deploy skip `checks` **and**
  `test` — recovering ~1.5 min on the common green-SHA prod/cli deploy (tags cut
  from a PR head). Keeping the backstop would've been cargo-culted caution.
- **Keep the fix that's orthogonal to the invariant.** The deploy job's explicit
  `if: always() && needs.compile_test.result == 'success'` (from #2788, fixing
  the skipped-ancestor propagation that silently skipped the deploy) stays — it's
  about job-graph mechanics, not about what `compile_test` means.
- **`call-ai-publish` keeps the name on purpose.** It runs the full suite via
  `actions/base`, so its `compile_test` is a *legitimate* "tested" signal — a
  deploy reusing it is correct. Only the test-skipping jobs were the problem.
- **Re-validate the prod path.** This re-touches the just-merged deploy workflow
  (green SHA now skips `checks` too), so it wants the same `vibes-diy@d*` dev-tag
  smoke test before a prod/cli tag — the workflow gets no PR CI.
