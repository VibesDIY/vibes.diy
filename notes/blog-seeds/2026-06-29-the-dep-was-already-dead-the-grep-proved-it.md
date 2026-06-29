# The dependency was already dead — three phases to prove it safe to delete

Source: `claude/bucket-e-phase3-drop-core-runtime-dep` (Bucket E Phase 3, follows #2826 + #2833 / issue #2468)

The goal of Bucket E was to stop 18 packages depending on `@fireproof/core-runtime`. The
instinct is to start by rewriting the code that uses it. The actual sequence that worked was
the opposite — prove the dependency is unreachable, *then* delete the declaration:

- **Phase 1** narrowed the two production sites that only needed `nextId()` onto a
  `RuntimeContext` seam, and inventoried the rest.
- **Phase 2** routed the 74 test-harness imports through the same seam (behavior-identical
  re-export) — the unglamorous step that actually mattered.
- **Phase 3** (this PR) then found, by grep, that *no file outside the identity package
  imports `@fireproof/core-runtime` at all anymore* — not in source, not in tests, not in
  build configs or `exports` maps. So the dep declaration in all 18 package.jsons was pure
  dead weight, and removal is a `package.json` line-delete verified by build + the
  browser-import-map check + CI. The dep now lives only in `vibes.diy/identity`, the seam.

The post worth writing: a dependency removal that looks like a scary 18-package refactor can
collapse to a one-line-per-file deletion *if you spend the earlier phases making the dep
unreachable first* — and the proof that it's safe is a grep that comes back empty, not a
test you write. The split-by-risk commit structure (internal/test packages, then
published/browser ones) is the cheap insurance: there's a documented prior incident
(`pkg@p2.4.10`) where a stray core-runtime import blanked every vibe in the browser, so the
published half gets its own revertible commit even though CI is green on both.
