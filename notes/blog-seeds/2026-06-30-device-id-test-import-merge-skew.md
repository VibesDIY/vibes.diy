# The merge that broke main without any PR failing CI

Source: `claude/fix-device-id-test-imports` (hotfix)

`@fireproof/core-device-id` was in-sourced into `@vibes.diy/identity` (#2937), which dropped it as an
`api/tests` dependency and re-exported the test harness (`createTestDeviceCA`/`createTestUser`) from
`@vibes.diy/identity/testing`. #2937 migrated the importers it could see — but two other branches in
flight (the backend.js B5 onChange tests, and a cached-suggestion test) still imported the helpers from
the old `@fireproof/core-device-id`. Each branch was green against its own pre-#2937 base; none of them
conflicted textually. They only collided *semantically* once all three were on `main`: the package was
gone, four test files still imported it, and `tsc` went red — a breakage no single PR's CI could have
caught, because the conflict didn't exist in any one PR's tree.

The fix is a one-line-per-file specifier swap to `@vibes.diy/identity/testing`. The lesson is the
interesting part: per-PR CI proves each diff against a *base*, not against the other diffs racing toward
the same base. A package rename/removal is exactly the shape that slips through — the remover can't see
importers that aren't merged yet. Worth a guard (a merge-queue that re-runs the build on the *post-merge*
tree, or a codemod that lands the removal and all importer updates atomically).
