# Routing 74 test imports through a seam that re-exports the same function — cosmetic until it's load-bearing

Source: `claude/bucket-e-phase2-seam-test-imports` (Bucket E Phase 2, follows #2826 / issue #2468)

Phase 1 narrowed the two production call sites that only needed `nextId()` onto the
`@vibes.diy/identity` `RuntimeContext` seam and left the ~80 test harnesses importing
`ensureSuperThis` straight from `@fireproof/core-runtime`. The Phase 1 review flagged the
catch: those direct test imports are *cosmetic for narrowing* but *load-bearing for the
de-fireproof finish line* — `@fireproof/core-runtime` can't actually be dropped from a
package while its tests still import from it directly, even after every source site narrows.
So Phase 2 is the unglamorous prerequisite: swap `from "@fireproof/core-runtime"` →
`from "@vibes.diy/identity"` across 74 test files (the seam re-exports the identical
function object, so behavior is byte-identical), and add the one missing
`@vibes.diy/identity` workspace dep to `use-vibes/tests`. The post worth writing: a
mechanical import-source swap that changes zero behavior can still be the thing standing
between you and deleting a dependency — and the way you find out is the linter, not the
type-checker. `tsc` was happy with two imports from the same specifier; eslint's
`import/no-duplicates` is what caught the file that already imported from the seam, forcing
the merge. The gotcha is that "route everything through the seam" quietly collides with
"one import per module," and only the lint rule sees it.
